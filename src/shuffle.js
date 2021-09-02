import { iterBitStream } from './util.js'
import { boundedRandom } from './random.js'

/**
 * Return an array fully filled with bounded random values appropriate
 * to shuffle a list. The maximum sized list that can be shuffled is
 * the size of the returned seed array + 1
 * @param {BitStream} bitStream
 * @returns {Array}
 */
export const getShuffleSeed = (bitStream) => {
  return Array.from(
    iterBitStream((s) => boundedRandom(s + 2, bitStream))
  )
}

const arraySwap = (arr, i, j) => {
  if (i === j) { return }
  [arr[i], arr[j]] = [arr[j], arr[i]]
}

/**
 * Shuffle provided array **in place** using the given shuffle seed.
 * @see {@link getShuffleSeed}
 * @param {Array} array
 * @param {Array} shuffleSeed
 * @returns {Array}
 */
export function shuffleSelf(array, shuffleSeed) {
  const size = array.length
  if (!size) { return array }
  if (size > shuffleSeed.length + 1) {
    throw new Error(`Insufficient sized seed to shuffle this array. Max length: ${shuffleSeed.length + 1}`)
  }
  for (let i = size; i > 1; i--) {
    const r = shuffleSeed[i - 2]
    // swap values at i-1 and r
    arraySwap(array, i - 1, r)
  }
  return array
}

/**
 * Get a shuffled copy of provided array using the given shuffle seed.
 * @see {@link getShuffleSeed}
 * @param {Array} array
 * @param {Array} shuffleSeed
 * @returns {Array}
 */
export function shuffle(array, shuffleSeed) {
  return shuffleSelf(array.slice(), shuffleSeed)
}
