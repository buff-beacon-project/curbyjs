const { fetchLast, consumer, iterUntilCaught, msToNextPulse } = require('..')

const arr = Array(60).fill(0).map((x, i) => i)

fetchLast().then(pulse => {
  console.log(pulse.value)
  return pulse
}).then(p => {
  const { shuffleSeed } = consumer(p)
  console.log(shuffleSeed, shuffleSeed.every((v, i) => v < i + 2))
  const mixed = consumer(p).shuffle(arr)
  console.log(mixed)

  const { bitStream } = consumer(p)
  const directions = ['up', 'down', 'left', 'right']
  const randomDirections = Array.from(
    iterUntilCaught(() => directions[bitStream.readBits(2, false)])
  )
  console.log(randomDirections, randomDirections.length)

  console.log('ms to next pulse', msToNextPulse())
  // nextPulseAt()
})

// shuffle
// views
