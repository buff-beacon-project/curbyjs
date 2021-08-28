import axios from 'axios'
import { getTimeStamp } from './util'
import stringify from 'safe-stable-stringify'
import { KJUR } from 'jsrsasign'
import { SHA3 } from 'sha3'
import * as Errors from './errors'
import * as StatusCodes from './status-codes'

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

export function validatePulse(pulse, certPEM){
  if (pulse.content.pulse_index !== 0 && StatusCodes.has(pulse, StatusCodes.UnmatchedPrecom)) {
    throw new Errors.LatePulse('Pulse has unmatched precommitment value')
  }

  const message = serializePulse(pulse)
  const alg = getSigningAlgorithm(pulse)
  const sig = new KJUR.crypto.Signature({ alg })
  sig.init(certPEM)
  sig.updateString(message)
  if (!sig.verify(pulse.signature)) {
    throw new Errors.InvalidSignature('Invalid pulse signature!')
  }

  const hash = getHashFunction(pulse)
  if (hash(pulse.signature, 'hex') !== pulse.value) {
    throw new Errors.InvalidPulse('Pulse value does not match hash of signature!')
  }

  return true
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
  return beaconFetch(`/at/${ts}`).then(parseResponseAndValidate)
}

export function fetchAfter(date) {
  const ts = getTimeStamp(date)
  return beaconFetch(`/after/${ts}`).then(parseResponseAndValidate)
}

export function fetchBefore(date) {
  const ts = getTimeStamp(date)
  return beaconFetch(`/before/${ts}`).then(parseResponseAndValidate)
}

export function fetchSubchain(chain, start, end){
  return beaconFetch(`/chain/${chain}/subchain/${start}/${end}`)
    .then(res => res.data)
    .then(subchain => {
      subchain.pulses.forEach(fetchCertAndValidatePulse)
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
