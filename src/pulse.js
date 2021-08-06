import axios from 'axios'

const fetch = axios.create({
  baseURL: 'http://71.56.217.42:8000/api/'
  , timeout: 10000
});

export function fetchLast() {
  return fetch('/last').then(r => r.data)
}

export function nextPulseAt() {
  const d = new Date()
  d.setMinutes(d.getMinutes() + 1, 0, 0)
  return d
}

export function msToNextPulse() {
  return nextPulseAt().getTime() - (new Date()).getTime()
}
