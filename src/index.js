import axios from 'axios'
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

export function createDataView(pulse){
  const b = Buffer.from(pulse.value, 'hex')
  return new DataView(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength))
}

/**
 * Creates an array of shuffled values, using a version of the
 * [Fisher-Yates shuffle](https://en.wikipedia.org/wiki/Fisher-Yates_shuffle).
 *
 * @since 0.1.0
 * @category Array
 * @param {Array} array The array to shuffle.
 * @returns {Array} Returns the new shuffled array.
 * @example
 *
 * shuffle([1, 2, 3, 4])
 * // => [4, 1, 3, 2]
 */
export function shuffle(array, consumer) {
  const length = array == null ? 0 : array.length
  if (!length) {
    return []
  }
  let index = -1
  const lastIndex = length - 1
  const result = array.concat([])
  while (++index < length) {
    const rand = index + consumer.lessThan(lastIndex - index + 1)
    const value = result[rand]
    result[rand] = result[index]
    result[index] = value
  }
  return result
}

export function consumer(pulse){
  const dataView = createDataView(pulse)
  const buffer = dataView.buffer
  const bitStream = new BitStream(buffer)

  return {
    dataView
    , buffer
    , bitStream
    , lessThan: (max) => {
      if (max < 0){ throw new Error('Value must be positive') }
      if (max < 2){ return 0 }
      const nbits = Math.ceil(Math.log2(max))
      const ret = bitStream.readBits(nbits, false) % max
      // console.log(max, nbits, ret)
      return ret
    }
  }
}
