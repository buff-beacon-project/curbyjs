export const UnmatchedPrecom = 1 // 0b0001 // Starting status for a chain
// pulse timestep more than 1 period away
export const TimeGap = 2 // 0b0010
// certificate of non-first pulse has changed
export const ChangedCert = 4 // 0b0100
export const IntentionallyLastInChain = 8 // 0b1000

export function has(pulse, code){
  return !!(pulse.content.status & code)
}
