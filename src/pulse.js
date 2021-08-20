import axios from 'axios'
import { getTimeStamp } from './util'
import stringify from 'safe-stable-stringify'
import { KJUR } from 'jsrsasign'
import { SHA3 } from 'sha3';

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
  const message = serializePulse(pulse)
  const alg = getSigningAlgorithm(pulse)
  const sig = new KJUR.crypto.Signature({ alg })
  sig.init(certPEM)
  sig.updateString(message)
  if (!sig.verify(pulse.signature)) {
    throw new Error('Invalid pulse signature!')
  }

  const hash = getHashFunction(pulse)
  if (hash(pulse.signature, 'hex') !== pulse.value) {
    throw new Error('Pulse value does not match hash of signature!')
  }

  return true
}

async function parseResponseAndValidate(res){
  const pulse = res.data

  const certId = pulse.content.certificate_id
  let cert = CERTIFICATES[certId]
  if (!cert){
    cert = await fetchCertificate(certId)
    CERTIFICATES[certId] = cert
  }

  validatePulse(pulse, cert) // throws if invalid

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
  return beaconFetch('/latest').then(parseResponseAndValidate)
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

export function nextPulseAt(latestPulse) {
  const d = new Date(latestPulse.content.time_stamp)
  d.setTime(d.getTime() + latestPulse.content.period)
  return d
}

export function msToNextPulse(latestPulse) {
  return nextPulseAt(latestPulse).getTime() - (new Date()).getTime()
}
