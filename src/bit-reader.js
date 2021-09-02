import { hex2buf, iterBitStream } from './util.js'
import { getShuffleSeed, shuffle, shuffleSelf } from './shuffle.js'
import { BitStream, BitView } from 'bit-buffer'

/**
 * Helper class to read bits from pulse value.
 * **Note**: it is recommended to use `BitReader.from()`
 * @see {@link BitReader.from}
 * @param {ArrayBuffer}
 */
export class BitReader {
  /**
   * Create a BitReader object from pulse or hex string
   * @param {Object|String} pulseOrHexString
   * @returns {BitReader}
   */
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

  /**
   * The shuffleSeed for the data.
   * @see {getShuffleSeed}
   */
  get shuffleSeed() {
    if (!this._shuffleSeed) {
      this._shuffleSeed = getShuffleSeed(this.stream())
    }
    return this._shuffleSeed
  }

  /**
   * The maximum length of list this instance can shuffle.
   * @see {getShuffleSeed}
   */
  get maxShuffleLength() {
    return this.shuffleSeed.length + 1
  }

  /**
   * Get a DataView of the bits.
   * @param {Number} byteOffset
   * @param {Number} byteLength
   * @returns {DataView}
   */
  dataView(byteOffset, byteLength) {
    return new DataView(this.buffer, byteOffset, byteLength)
  }

  /**
   * Get a BitStream of this data.
   * @link https://github.com/inolen/bit-buffer
   * @returns {BitStream}
   */
  stream() {
    return new BitStream(this.buffer)
  }

  /**
   * Get a BitView of this data.
   * @link https://github.com/inolen/bit-buffer
   * @returns {BitView}
   */
  view() {
    return new BitView(this.buffer)
  }

  /**
   * Return a shuffled copy of provided array.
   * @param {Array} array
   * @returns {Array}
   */
  shuffled(array) {
    return shuffle(array, this.shuffleSeed)
  }

  /**
   * Shuffle the provided array in place, modifying it.
   * @param {Array} array
   * @returns {Array}
   */
  applyShuffle(array) {
    shuffleSelf(array, this.shuffleSeed)
  }

  /**
   * Use given function to read a BitStream and generate array elements.
   * @example
   * // generate a list of boolean values
   * const reader = BitReader.from(pulse)
   * const toggles = reader.unfold((stream) => stream.readBoolean())
   * @link https://github.com/inolen/bit-buffer
   * @param {Function} fn
   * @param {class} cls=Array
   * @returns {ArrayLike}
   */
  unfold(fn, cls = Array) {
    const stream = this.stream()
    return cls.from(iterBitStream((i) => fn(stream, i)))
  }
}
