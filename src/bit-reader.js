import { hex2buf, iterBitStream } from './util'
import { getShuffleSeed, shuffle, shuffleSelf } from './shuffle'
import { BitStream, BitView } from 'bit-buffer'

export class BitReader {
  static from(pulseOrHexString) {
    if (typeof pulseOrHexString === 'object') {
      return BitReader.from(pulseOrHexString.value)
    }

    return new BitReader(hex2buf(pulseOrHexString))
  }

  constructor(buffer) {
    if (!(buffer instanceof ArrayBuffer)) {
      throw new Error('Value passed to constructor is not an ArrayBuffer')
    }
    this.buffer = buffer
    this._shuffleSeed = null
  }

  get shuffleSeed() {
    if (!this._shuffleSeed) {
      this._shuffleSeed = getShuffleSeed(this.stream())
    }
    return this._shuffleSeed
  }

  get maxShuffleLength() {
    return this.shuffleSeed.length + 1
  }

  dataView(byteOffset, byteLength) {
    return new DataView(this.buffer, byteOffset, byteLength)
  }

  stream() {
    return new BitStream(this.buffer)
  }

  view() {
    return new BitView(this.buffer)
  }

  shuffled(array) {
    return shuffle(array, this.shuffleSeed)
  }

  applyShuffle(array) {
    shuffleSelf(array, this.shuffleSeed)
  }

  unfold(fn, cls = Array) {
    const stream = this.stream()
    return cls.from(iterBitStream((i) => fn(stream, i)))
  }
}
