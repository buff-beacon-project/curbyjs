import axios from 'axios'
import { Buffer } from 'buffer'
import { BitStream } from 'bit-buffer'

const MAXU2 = 3
const MAXU4 = 15
const MAXU8 = 255
const MAXU16 = 65535
const MAXU32 = 4294967295

const bitsPerPulse = 512
const maxListShuffle = 91

// const rng = await curby() // rng from latest pulse
// rng.random()
// rng.integer(min, max)
// rng.integer(max) // -> random number from latest pulse, validated
// rng.bytes(64) // -> UInt8Array(64)
// rng.fillBytes()

// rng.checkIntegrity()

// await curby.fetchPulse(0, 3) // chain 0, pulse 3

const fetch = axios.create({
  baseURL: 'http://71.56.217.42:8000/api/'
  , timeout: 1000
});

export function fetchLast(){
  return fetch('/last').then(r => r.data)
}

export function nextPulseAt(){
  const d = new Date()
  d.setMinutes(d.getMinutes() + 1, 0, 0)
  return d
}

export function msToNextPulse(){
  return nextPulseAt().getTime() - (new Date()).getTime()
}

export function createDataView(pulse){
  const b = Buffer.from(pulse.value, 'hex')
  return new DataView(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength))
}

const arraySwap = (arr, i, j) => {
  if (i === j){ return }
  [arr[i], arr[j]] = [arr[j], arr[i]]
}

export function shuffleSelf(array, shuffleSeed){
  const size = array.length
  if (!size){ return array }
  if (size > shuffleSeed.length + 1){
    throw new Error(`Insufficient sized seed to shuffle this array. Max length: ${shuffleSeed.length + 1}`)
  }
  for (let i = size; i > 1; i--){
    const r = shuffleSeed[i - 2]
    // swap values at i-1 and r
    arraySwap(array, i - 1, r)
  }
  return array
}

export function shuffle(array, shuffleSeed){
  return shuffleSelf(array.slice(), shuffleSeed)
}

// https://arxiv.org/abs/1805.10941
// https://lemire.me/blog/2016/06/30/fast-random-shuffling/
export function boundedRandom(s, bitStream){
  if (s < 0 || s % 1 !== 0) { throw new Error('Value must be a positive integer >= 2') }
  if (s < 2) { return 0 }
  const log2s = Math.log2(s)
  const nbits = Math.ceil(log2s)
  const max = 1 << nbits
  if (!Number.isSafeInteger(max * (s - 1))){
    throw new Error('Range is too high to evaluate')
  }

  if ( log2s % 1 === 0 ){
    // is whole... so we can just read bits
    // without filtering
    return bitStream.readBits(nbits, false)
  }

  let x = bitStream.readBits(nbits, false)
  let m = x * s
  let l = m % max
  if (l < s){
    const threshold = (max - s) % s
    while (l < threshold){
      x = bitStream.readBits(nbits, false)
      m = x * s
      l = m % max
    }
  }
  return m >> nbits
}

export function* iterUntilCaught(fn){
  let i = 0
  try {
    while (true){
      yield fn(i++)
    }
  } catch (e){}
}

// Return an array fully filled with bounded random values appropriate
// to shuffle a list. The maximum sized list that can be shuffled is
// the size of the returned seed array + 1
const getShuffleSeed = (bitStream) => {
  return Array.from(
    iterUntilCaught((s) => boundedRandom(s + 2, bitStream))
  )
}

export function consumer(pulse){
  const dataView = createDataView(pulse)
  const buffer = dataView.buffer
  const bitStream = new BitStream(buffer)
  const shuffleSeed = getShuffleSeed(new BitStream(buffer))
  return {
    dataView
    , buffer
    , bitStream
    , shuffleSeed
    , shuffle(array){
      return shuffle(array, shuffleSeed)
    }
  }
}
