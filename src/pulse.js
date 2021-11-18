import axios from 'axios'
import { getTimeStamp, zip, hex2bytes, bytesToHex, xorArrays } from './util.js'
import { serializePulseContent } from './serialize.js'
import { KJUR } from 'jsrsasign'
import { SHA3 } from 'sha3'
import * as Errors from './errors.js'
import * as StatusCodes from './status-codes.js'
import { certFromPem, validateCertChain } from './cert-chain.js'
import { YUBIHSM2_ATTEST_CA_CRT, E45DA5F361B091B30D8F2C6FA040DB6FEF57918E } from './certs.js'

const CACHED_SIGNATURES = {}
const CERT_CHAIN = {
  trustedCerts: [certFromPem(YUBIHSM2_ATTEST_CA_CRT)]
  , certs: [
    certFromPem(E45DA5F361B091B30D8F2C6FA040DB6FEF57918E)
  ]
}
const VALID_CERTS = {}
const CERTIFICATES = {}

const beaconFetch = axios.create({
  baseURL: 'https://random.colorado.edu/api/'
  , timeout: 10000
  , headers: {
    // Accept in curby v1 json format
    'Accept': 'application/vnd.curby.v1+json'
  }
})

/**
 * Globally override the domain (with or without protocol) for beacon api.
 * @param {String} domain
 * @returns {void}
 */
export function setBeaconDomain(domain){
  if (domain.substr(0, 4) !== 'http'){
    domain = 'https://' + domain
  }
  beaconFetch.defaults.baseURL = `${domain}/api/`
}

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

// export function serializePulse(pulse){
//   return stringify(pulse.content)
// }

/**
 * Asserts that `prevPulse` contains a valid precommitment value of `pulse`.
 * @param {Object} prevPulse
 * @param {Object} pulse
 * @throws {InvalidPrecom}
 * @returns {Boolean}
 */
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

/**
 * Assert that the given pulse is valid for use as a randomness source.
 * Checks the signature is valid, the value is a hash of signature, and
 * that the status code has appropriate flags for use.
 * @param {Object} pulse
 * @param {String} certPEM Certificate in PEM format
 * @throws {InvalidPulse}
 * @throws {InvalidSignature}
 * @returns {Boolean}
 */
export function validatePulse(pulse, certPEM){
  if (pulse.content.pulse_index !== 0 && StatusCodes.hasStatus(pulse, StatusCodes.UnmatchedPrecom)) {
    throw new Errors.InvalidPulse('Pulse has unmatched precommitment value')
  }

  const message = serializePulseContent(pulse)

  let signatureValid = false
  if (message in CACHED_SIGNATURES){
    signatureValid = pulse.signature === CACHED_SIGNATURES[message]
  } else {
    const alg = getSigningAlgorithm(pulse)
    const sig = new KJUR.crypto.Signature({ alg })
    sig.init(certPEM)
    sig.updateHex(bytesToHex(message))
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

/**
 * Asserts that given pulse list contains an unbroken chain of pulses.
 * These can be either a sequential chain, or a skiplist. The list
 * will be sorted before verrification.
 * @param {Array<Object>} pulses
 * @throws {BrokenChain}
 * @returns {Boolean}
 */
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

/**
 * Assert that pulse does not have a TimeGap flag and has timing in
 * accordance with given rule.
 * If the rule is `latest`, the pulse is expected to have timestamp
 * within 1 pulse period of current time.
 * If the rule is `after`, the pulse timestamp is expected to be later
 * than but within one pulse period of given Date (inclusive).
 * If the rule is `at`, the pulse timestamp is expected to be later
 * than but within one pulse period of given Date (exclusive).
 * If the rule is `before`, the pulse timestamp is expected to be earlier
 * than but within one pulse period of given Date (exclusive).
 * @param {Object} pulse
 * @param {Object} rule
 * @param {Boolean} rule.latest
 * @param {Date} rule.after
 * @param {Date} rule.at
 * @param {Date} rule.before
 * @throws {LatePulse}
 * @returns {Boolean}
 */
export function checkPulseTiming(pulse, rule = { latest: true }){
  if (StatusCodes.hasStatus(pulse, StatusCodes.TimeGap) && pulse.content.pulse_index !== 0){
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

async function prefetchAttestationCerts(){
  const info = await fetchServiceInfo()
  return Promise.all(info.hsm_attestation_cert_ids.map(id => {
    return beaconFetch(`/certificate/${id}`, {
      responseType: 'text'
    })
      .then(res => res.data)
      .then(pem => validateCert(pem, false))
  }))
}

/**
 * Validate a certificate against the YUBIHSM attestation chain
 * @param {String} pem Certificate data in PEM format to check
 * @param {bool} [fetchAttestationCerts=true] whether to fetch the beacon attestation certs
 * @returns Promies<String> PEM data of valid certificate
 */
export async function validateCert(pem, fetchAttestationCerts = true){
  if (pem in VALID_CERTS){ return pem }
  if (fetchAttestationCerts){
    await prefetchAttestationCerts()
  }
  const cert = certFromPem(pem)
  await validateCertChain({
    trustedCerts: CERT_CHAIN.trustedCerts
    , certs: CERT_CHAIN.certs.concat(Object.values(VALID_CERTS))
  })
  // it's valid. add it to cache
  VALID_CERTS[pem] = cert
  return pem
}

/**
 * Validate the given pulse, fetching the certificate (or using
 * a cached reference).
 * @see {@link validatePulse}
 * @param {Object} pulse
 * @returns {Promise<Object>} resolves to given pulse
 */
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
  await fetchCertAndValidatePulse(pulse)
  return pulse
}

/**
 * Fetch the beacon service info
 * @returns {Promise<Object>} service info
 */
export function fetchServiceInfo(){
  return beaconFetch('/')
    .then(res => res.data)
}

/**
 * Fetch the given certificate by its hash id.
 * @param {String} hashId
 * @returns {Promise<String>} cert in PEM format
 */
export function fetchCertificate(hashId){
  return beaconFetch(`/certificate/${hashId}`, {
    responseType: 'text'
  })
    .then(res => res.data)
    .then(pem => validateCert(pem))
}

/**
 * Fetch and validate a pulse by chain and pulse indicies.
 * @param {Number} chainIndex
 * @param {Number} pulseIndex
 * @returns {Promise<Object>} resolves to the pulse data
 */
export function fetch(chainIndex, pulseIndex){
  return beaconFetch(`/chain/${chainIndex}/pulse/${pulseIndex}`).then(parseResponseAndValidate)
}

/**
 * Fetch and validate the latest pulse.
 * @returns {Promise<Object>} resolves to the pulse data
 */
export function fetchLatest() {
  return beaconFetch('/latest')
    .then(parseResponseAndValidate)
    .then(pulse => checkPulseTiming(pulse))
}

/**
 * Fetch and validate pulse at or within one period of given timestamp.
 * @param {String|Date} date
 * @returns {Promise<Object>} resolves to the pulse data
 */
export function fetchAt(date){
  const ts = getTimeStamp(date)
  return beaconFetch(`/at/${ts}`)
    .then(parseResponseAndValidate)
    .then(pulse => checkPulseTiming(pulse, { at: date }))
}

/**
 * Fetch and validate earliest pulse after given timestamp.
 * @param {String|Date} date
 * @returns {Promise<Object>} resolves to the pulse data
 */
export function fetchAfter(date) {
  const ts = getTimeStamp(date)
  return beaconFetch(`/after/${ts}`)
    .then(parseResponseAndValidate)
    .then(pulse => checkPulseTiming(pulse, { after: date }))
}

/**
 * Fetch and validate latest pulse before given timestamp.
 * @param {String|Date} date
 * @returns {Promise<Object>} resolves to the pulse data
 */
export function fetchBefore(date) {
  const ts = getTimeStamp(date)
  return beaconFetch(`/before/${ts}`)
    .then(parseResponseAndValidate)
    .then(pulse => checkPulseTiming(pulse, { before: date }))
}

/**
 * Fetch and validate subchain of specified chain between start
 * and end indices.
 * @param {any} chainIndex
 * @param {any} startIndex
 * @param {any} endIndex
 * @returns {Promise<Object>} resolves to the subchain data
 */
export function fetchSubchain(chainIndex, startIndex, endIndex){
  return beaconFetch(`/chain/${chainIndex}/subchain/${startIndex}/${endIndex}`)
    .then(res => res.data)
    .then(subchain => {
      subchain.pulses.forEach(fetchCertAndValidatePulse)
      checkChainIntegrity(subchain.pulses)
      return subchain
    })
}

/**
 * Fetch and validate skiplist of specified chain between start
 * and end indices.
 * @param {any} chainIndex
 * @param {any} startIndex
 * @param {any} endIndex
 * @returns {Promise<Object>} resolves to the skiplist data
 */
export function fetchSkiplist(chainIndex, startIndex, endIndex) {
  return beaconFetch(`/chain/${chainIndex}/skiplist/${startIndex}/${endIndex}`)
    .then(res => res.data)
    .then(subchain => {
      subchain.pulses.forEach(fetchCertAndValidatePulse)
      checkChainIntegrity(subchain.pulses)
      return subchain
    })
}

/**
 * Calculate the ETA datetime the next pulse will be released.
 * @param {Object} latestPulse
 * @returns {Date}
 */
export function nextPulseAt(latestPulse) {
  const d = new Date(latestPulse.content.time_stamp)
  d.setTime(d.getTime() + latestPulse.content.period)
  return d
}

/**
 * Calculate the number of milliseconds before release of the
 * next pulse.
 * @param {Object} latestPulse
 * @returns {Number}
 */
export function msToNextPulse(latestPulse) {
  return nextPulseAt(latestPulse).getTime() - (new Date()).getTime()
}
