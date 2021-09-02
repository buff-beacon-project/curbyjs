
/**
 * Get an unbiased "random" number within the range `[0, s)`. The "random"
 * values are read from the provided bitStream. The function attempts to read
 * as few bits as possible to achieve this.
 * @param {Number} s Upper bound (exclusive)
 * @param {BitStream} bitStream
 * @returns {Number}
 */
export function boundedRandom(s, bitStream) {
  // https://arxiv.org/abs/1805.10941
  // https://lemire.me/blog/2016/06/30/fast-random-shuffling/
  if (s < 0 || s % 1 !== 0) { throw new Error('Value must be a positive integer >= 2') }
  if (s < 2) { return 0 }
  const log2s = Math.log2(s)
  const nbits = Math.ceil(log2s)
  const max = 1 << nbits
  if (!Number.isSafeInteger(max * (s - 1))) {
    throw new Error('Range is too high to evaluate')
  }

  if (log2s % 1 === 0) {
    // is whole... so we can just read bits
    // without filtering
    return bitStream.readBits(nbits, false)
  }

  let x = bitStream.readBits(nbits, false)
  let m = x * s
  let l = m % max
  if (l < s) {
    const threshold = (max - s) % s
    while (l < threshold) {
      x = bitStream.readBits(nbits, false)
      m = x * s
      l = m % max
    }
  }
  return m >> nbits
}
