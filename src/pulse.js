import axios from 'axios'
import { getTimeStamp } from './util'
import { pki } from 'node-forge'

const beaconFetch = axios.create({
  baseURL: 'http://71.56.217.42:8000/api/'
  , timeout: 10000
});

const CERTIFICATES = {}

export function getPulseDigest(pulse){
  return new ArrayBuffer(512)
}

async function parseResponseAndValidate(res){
  const pulse = res.data

  let cert = CERTIFICATES[pulse.certificate_id]
  if (!cert){
    cert = pki.certificateFromPem(await fetchCertificate(pulse.certificate_id), true)
    CERTIFICATES[pulse.certificate_id] = cert
  }

  const digest = getPulseDigest()
  if (!cert.verify(digest, pulse.signature)){
    throw new Error('Invalid pulse signature!')
  }

  return pulse
}

export function fetchCertificate(hashId){
  return beaconFetch(`/certificate/${hashId}`, {
    responseType: 'text'
  })
    .then(res => res.data)
    .then(text => {
      return text.replace(
        /-----BEGIN ([A-Za-z0-9- ]+)-----/,
        '-----BEGIN CERTIFICATE-----'
      ).replace(
        /-----END ([A-Za-z0-9- ]+)-----/,
        '-----END CERTIFICATE-----'
      )
    })
    .then(text => {
      console.log(text)
      return text
    })
}

export function fetch(chain, pulse){
  return beaconFetch(`/chain/${chain}/pulse/${pulse}`).then(parseResponseAndValidate)
}

export function fetchLast() {
  return beaconFetch('/last').then(parseResponseAndValidate)
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

export function nextPulseAt() {
  const d = new Date()
  d.setMinutes(d.getMinutes() + 1, 0, 0)
  return d
}

export function msToNextPulse() {
  return nextPulseAt().getTime() - (new Date()).getTime()
}
