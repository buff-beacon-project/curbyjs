/* eslint-disable camelcase */
/* eslint-disable comma-style */
import { serialize } from 'borsh'
import { hex2bytes } from './util.js'

const HashOut = [64]
const HashFields = [
  'certificate_id'
  , 'local_random_value'
  , 'precommitment_value'
  , 'id'
  , 'signature'
  , 'value'
]

class Schema {
  constructor(v) {
    Object.assign(this, v)
    HashFields.forEach(k => {
      if (k in this && typeof this[k] === 'string') {
        this[k] = hex2bytes(this[k])
      }
    })
  }
}

class External extends Schema { }
class Link extends Schema { }
class PulseContent extends Schema {
  constructor(v){
    super(v)
    this.skip_anchors = this.skip_anchors.map((v) => new Link(v))
    this.external = this.external.map((v) => new External(v))
  }
}
class Pulse extends Schema { }

const CurbySchema = new Map([
  [External, {
    'kind': 'struct',
    'fields': [
      ['id', HashOut],
      ['reference', 'string'],
      ['status', 'u32'],
      ['value', HashOut]
    ]
  }],
  [Link, {
    'kind': 'struct',
    'fields': [
      ['pulse_index', 'u32'],
      ['value', HashOut]
    ]
  }],
  [PulseContent, {
    'kind': 'struct',
    'fields': [
      ['source', 'string'],
      ['version', 'string'],
      ['cypher_suite', 'u32'],
      ['period', 'u32'],
      ['certificate_id', HashOut],
      ['chain_index', 'u32'],
      ['pulse_index', 'u32'],
      ['time_stamp', 'string'],
      ['local_random_value', HashOut],
      ['external', [External]],
      ['skip_radix', 'u8'],
      ['skip_anchors_length', 'u8'],
      ['skip_anchors', [Link]],
      ['precommitment_value', HashOut],
      ['status', 'u32']
    ]
  }],
  [Pulse, {
    'kind': 'struct',
    'fields': [
      ['content', PulseContent],
      ['signature', ['u8']],
      ['value', HashOut]
    ]
  }]
])

/**
 * Serialize the pulse content
 * @param {Object} pulse
 * @returns {Uint8Array}
 */
export function serializePulseContent(pulse){
  return serialize(CurbySchema, new PulseContent(pulse.content))
}
