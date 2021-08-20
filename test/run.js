const { fetchLatest, BitReader, msToNextPulse, setBeaconDomain } = require('..')

setBeaconDomain('http://192.168.99.105:8000')

const arr = Array(60).fill(0).map((x, i) => i)

fetchLatest().then(pulse => {
  console.log(pulse.value)
  return pulse
}).then(p => {
  const reader = BitReader.from(p)
  console.log(reader.shuffleSeed, reader.shuffleSeed.every((v, i) => v < i + 2))
  const mixed = reader.shuffled(arr)
  console.log(mixed)

  const directions = ['up', 'down', 'left', 'right']
  const randomDirections = reader.unfold((stream) =>
    directions[stream.readBits(2, false)]
  )
  console.log(randomDirections, randomDirections.length)

  console.log('ms to next pulse', msToNextPulse(p))
  // nextPulseAt()
})

