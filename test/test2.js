import {
  fetchLatest,
  BitReader,
  msToNextPulse,
  fetchSkiplist,
  checkChainIntegrity
} from 'curbyjs'

const DECK_OF_CARDS_ARRAY = [/* cards */]

async function randomWalk() {
  // Fetches certificates and latest pulse
  // Validates signature automatically
  const latestPulse = await fetchLatest()

  const reader = BitReader.from(latestPulse)
  const directions = ['up', 'down', 'left', 'right']
  const randomDirections = reader.unfold((stream) =>
    directions[stream.readBits(2, false)]
  )

  console.log('A random walk: ', randomDirections)

  const delay = msToNextPulse(latestPulse)
  console.log(`Next random walk in ${delay}ms`)
  setTimeout(randomWalk, delay)
}

async function verifySkiplist(){
  const latestPulse = await fetchLatest()
  // Fetch a skiplist from first pulse to latest pulse
  const skiplist = await fetchSkiplist(
    latestPulse.chain_index,
    0, latestPulse.pulse_index
  )
  // Verify the skiplist
  try {
    checkChainIntegrity(skiplist.pulses)
  } catch (error) {
    console.log('Warning: Break in the chain', error)
  }
}

async function cardShuffle(){
  // if already fetched, the pulse is cached
  const latestPulse = await fetchLatest()
  const reader = BitReader.from(latestPulse)
  return reader.shuffled(DECK_OF_CARDS_ARRAY)
}

randomWalk()
cardShuffle()
verifySkiplist()
