/**
 * Unmatched precommitment value
 * @const {Number}
 */
export const UnmatchedPrecom = 1 // 0b0001 // Starting status for a chain
/**
 * pulse timestep more than 1 period away
 * @const {Number}
 */
export const TimeGap = 2 // 0b0010
/**
 * Certificate of non-first pulse has changed
 * @const {Number}
 */
export const ChangedCert = 4 // 0b0100
/**
 * Intentionally the last pulse in chain
 * @const {Number}
 */
export const IntentionallyLastInChain = 8 // 0b1000

/**
 * Check if a pulse has a given status code
 * @param {Object} pulse
 * @param {Number} code
 * @returns {Boolean}
 */
export function hasStatus(pulse, code){
  return !!(pulse.content.status & code)
}
