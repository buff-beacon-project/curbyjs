export function hex2buf(input) {
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
  }).buffer
}

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
