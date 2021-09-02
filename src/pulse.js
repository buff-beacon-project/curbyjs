import axios from 'axios'
import { getTimeStamp, zip, hex2bytes, xorArrays } from './util.js'
import stringify from 'safe-stable-stringify'
import { KJUR } from 'jsrsasign'
import { SHA3 } from 'sha3'
import * as Errors from './errors.js'
import * as StatusCodes from './status-codes.js'

const CACHED_SIGNATURES = {}

const beaconFetch = axios.create({
  baseURL: 'https://random.colorado.edu/api/'
  , timeout: 10000
})

export function setBeaconDomain(domain){
  if (domain.substr(0, 4) !== 'http'){
    domain = 'https://' + domain
  }
  beaconFetch.defaults.baseURL = `${domain}/api/`
}

const CERTIFICATES = {}

function getSigningAlgorithm(pulse){
  switch (pulse.content.cypher_suite){
    case 0:
      return 'SHA256withECDSA'
    default:
      throw new Error(`Cypher suite ${pulse.content.cypher_suite} not implemented`)
  }
}

function getHashFunction(pulse){
  switch (pulse.content.cypher_suite) {
    case 0:
      return (() => {
        const hash = new SHA3(512)
        return (msg, encoding, outencoding) => {
          hash.reset()
          hash.update(msg, encoding)
          return hash.digest(outencoding || encoding)
        }
      })()
    default:
      throw new Error(`Cypher suite ${pulse.content.cypher_suite} not implemented`)
  }
}

export function serializePulse(pulse){
  return stringify(pulse.content)
}

export function checkPrecommitmentValue(prevPulse, pulse){
  const randLocal = hex2bytes(pulse.content.local_random_value)
  const value = xorArrays(randLocal, hex2bytes(prevPulse.value))
  const hash = getHashFunction(prevPulse)
  const hashed = hash(Buffer.from(value.buffer), null, 'hex')
  const valid = prevPulse.content.precommitment_value === hashed
  if (!valid){
    throw new Errors.InvalidPrecom('Invalid Precommitment Value')
  }
  return true
}

export function validatePulse(pulse, certPEM){
  if (pulse.content.pulse_index !== 0 && StatusCodes.has(pulse, StatusCodes.UnmatchedPrecom)) {
    throw new Errors.InvalidPulse('Pulse has unmatched precommitment value')
  }

  const message = serializePulse(pulse)

  let signatureValid = false
  if (message in CACHED_SIGNATURES){
    signatureValid = pulse.signature === CACHED_SIGNATURES[message]
  } else {
    const alg = getSigningAlgorithm(pulse)
    const sig = new KJUR.crypto.Signature({ alg })
    sig.init(certPEM)
    sig.updateString(message)
    signatureValid = sig.verify(pulse.signature)
  }

  if (!signatureValid) {
    throw new Errors.InvalidSignature('Invalid pulse signature!')
  }

  // ok signature. cache it
  CACHED_SIGNATURES[message] = pulse.signature

  const hash = getHashFunction(pulse)
  if (hash(pulse.signature, 'hex') !== pulse.value) {
    throw new Errors.InvalidPulse('Pulse value does not match hash of signature!')
  }

  return true
}

export function checkChainIntegrity(pulses){
  pulses = pulses.slice(0)
  // sort by pulse index
  pulses.sort((a, b) => a.content.pulse_index - b.content.pulse_index)
  const connected = zip(pulses, pulses.slice(1))
    .every(([prev, next]) => {
      const ok = next.content.skip_anchors.some(anchor => anchor.value === prev.value)
      if (!ok){
        throw new Errors.BrokenChain(
          `Provided chain is broken between pulse ${prev.content.pulse_index} and ${next.content.pulse_index}`
        )
      }
      return ok
    })

  return connected
}

export function checkPulseTiming(pulse, rule = { latest: true }){
  if (StatusCodes.has(pulse, StatusCodes.TimeGap)){
    throw new Errors.LatePulse('Pulse Status signifying TimeGap')
  }

  if (rule.latest){
    if (msToNextPulse(pulse) > 0){
      return pulse
    } else {
      throw new Errors.LatePulse('Unexpected Pulse Timing')
    }
  }

  if (rule.after) {
    const expected = new Date(rule.after).getTime()
    const actual = new Date(pulse.content.time_stamp).getTime()
    if ((actual - expected) <= pulse.content.period){
      return pulse
    } else {
      throw new Errors.LatePulse('Unexpected Pulse Timing')
    }
  }

  if (rule.at){
    const expected = new Date(rule.at).getTime()
    const actual = new Date(pulse.content.time_stamp).getTime()
    if ((actual - expected) < pulse.content.period){
      return pulse
    } else {
      throw new Errors.LatePulse('Unexpected Pulse Timing')
    }
  }

  if (rule.before){
    const expected = new Date(rule.before).getTime()
    const actual = new Date(pulse.content.time_stamp).getTime()
    if ((expected - actual) < pulse.content.period){
      return pulse
    } else {
      throw new Errors.LatePulse('Unexpected Pulse Timing')
    }
  }

  throw new Error('Invalid rule specified')
}

export async function fetchCertAndValidatePulse(pulse){
  const certId = pulse.content.certificate_id
  let cert = CERTIFICATES[certId]
  if (!cert) {
    cert = await fetchCertificate(certId)
    CERTIFICATES[certId] = cert
  }

  validatePulse(pulse, cert) // throws if invalid
  return pulse
}

async function parseResponseAndValidate(res){
  const pulse = res.data
  fetchCertAndValidatePulse(pulse)
  return pulse
}

export function fetchCertificate(hashId){
  return beaconFetch(`/certificate/${hashId}`, {
    responseType: 'text'
  })
    .then(res => res.data)
}

export function fetch(chain, pulse){
  return beaconFetch(`/chain/${chain}/pulse/${pulse}`).then(parseResponseAndValidate)
}

export function fetchLatest() {
  return beaconFetch('/latest')
    .then(parseResponseAndValidate)
    .then(pulse => checkPulseTiming(pulse))
}

export function fetchAt(date){
  const ts = getTimeStamp(date)
  return beaconFetch(`/at/${ts}`)
    .then(parseResponseAndValidate)
    .then(pulse => checkPulseTiming(pulse, { at: date }))
}

export function fetchAfter(date) {
  const ts = getTimeStamp(date)
  return beaconFetch(`/after/${ts}`)
    .then(parseResponseAndValidate)
    .then(pulse => checkPulseTiming(pulse, { after: date }))
}

export function fetchBefore(date) {
  const ts = getTimeStamp(date)
  return beaconFetch(`/before/${ts}`)
    .then(parseResponseAndValidate)
    .then(pulse => checkPulseTiming(pulse, { before: date }))
}

export function fetchSubchain(chain, start, end){
  return beaconFetch(`/chain/${chain}/subchain/${start}/${end}`)
    .then(res => res.data)
    .then(subchain => {
      subchain.pulses.forEach(fetchCertAndValidatePulse)
      checkChainIntegrity(subchain.pulses)
      return subchain
    })
}

export function fetchSkiplist(chain, start, end) {
  return beaconFetch(`/chain/${chain}/skiplist/${start}/${end}`)
    .then(res => res.data)
    .then(subchain => {
      subchain.pulses.forEach(fetchCertAndValidatePulse)
      checkChainIntegrity(subchain.pulses)
      return subchain
    })
}

export function nextPulseAt(latestPulse) {
  const d = new Date(latestPulse.content.time_stamp)
  d.setTime(d.getTime() + latestPulse.content.period)
  return d
}

export function msToNextPulse(latestPulse) {
  return nextPulseAt(latestPulse).getTime() - (new Date()).getTime()
}
