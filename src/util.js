// eslint-disable-next-line max-len
const isoDateRegExp = /(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z))/

export function isISODate(str) {
  return isoDateRegExp.test(str);
}

export function getTimeStamp(isoStrOrDate){
  if (typeof date === 'string' && isISODate(isoStrOrDate)) {
    return isoStrOrDate
  } else if (isoStrOrDate instanceof Date) {
    return isoStrOrDate.toISOString()
  }

  throw new Error('Date must be an ISO compliant datetime string, or a Date instance')
}

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
