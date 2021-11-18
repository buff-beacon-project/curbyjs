// eslint-disable-next-line max-len
const isoDateRegExp = /(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z))/

/**
 * Checks whether a datetime string is in ISO 8601 format
 * @param {String} str
 * @returns {Boolean}
 */
export function isISODate(str) {
  return isoDateRegExp.test(str);
}

/**
 * zip the provided arrays together
 * @param {ArrayLike} ...arrays
 * @returns {ArrayLike}
 */
export function zip(...arrays) {
  const minLen = Math.min(...arrays.map(arr => arr.length))
  const [firstArr, ...restArrs] = arrays
  return Array.prototype.map.call(
    firstArr.slice(0, minLen),
    (val, i) => [val, ...restArrs.map(arr => arr[i])]
  )
}

/**
 * Format the input as an ISO 8601 date string
 * @param {String|Date} isoStrOrDate
 * @returns {String}
 */
export function getTimeStamp(isoStrOrDate){
  if (typeof date === 'string' && isISODate(isoStrOrDate)) {
    return isoStrOrDate
  } else if (isoStrOrDate instanceof Date) {
    return isoStrOrDate.toISOString()
  }

  throw new Error('Date must be an ISO compliant datetime string, or a Date instance')
}

/**
 * Convert a Uint8Array to a hex string
 * @param {Uint8Array} input
 * @returns {String}
 */
export function bytesToHex(buffer) {
  return Array.prototype.map.call(buffer, x => ('00' + x.toString(16)).slice(-2)).join('')
}

/**
 * Parse hex string and return the bytes as a Uint8Array
 * @param {String} input
 * @returns {Uint8Array}
 */
export function hex2bytes(input){
  if (typeof input !== 'string') {
    throw new TypeError('Input must be a string')
  }

  const strLen = input.length
  if ((strLen % 2) !== 0) {
    throw new RangeError('Input string must be an even number of characters')
  }

  return Uint8Array.from({ length: strLen / 2 }, (v, i) => {
    i *= 2
    return parseInt(input.substring(i, i + 2), 16)
  })
}

/**
 * Parse hex string and return the data as an array buffer
 * @param {String} input
 * @returns {ArrayBuffer}
 */
export function hex2buf(input) {
  return hex2bytes(input).buffer
}

/**
 * Perform an XOR operation on two arrays
 * @param {ArrayLike} a
 * @param {ArrayLike} b
 * @returns {ArrayLike}
 */
export function xorArrays(a, b){
  const out = zip(a, b).map(([x, y]) => x ^ y)
  if (a.constructor && a.constructor.from){
    return a.constructor.from(out)
  }
  return out
}

/**
 * Utility to yield results from provided function using a bitstream.
 * Stops when bitstream runs out of usable bits.
 * @example
 * // creates an array of 8 bit numbers consuming the bitStream
 * Array.from(iterBitStream(() => bitStream.readBits(8)))
 * @generator
 * @param {Function} fn
 * @yields {any}
 */
export function* iterBitStream(fn) {
  let i = 0
  try {
    while (true) {
      yield fn(i++)
    }
  } catch (e) {
    if (e.name !== 'Error' || e.message.substr(0, 10) !== 'Cannot get') {
      throw e
    }
  }
}
