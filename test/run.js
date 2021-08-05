const { fetchLast, consumer, shuffle } = require('..')

const arr = Array(44).fill(0).map((x, i) => i)

fetchLast().then(pulse => {
  console.log(pulse.value)
  return pulse
}).then(p => {
  const { shuffleSeed } = consumer(p)
  console.log(shuffleSeed, shuffleSeed.every((v, i) => v < i + 2))
  const mixed = consumer(p).shuffle(arr)
  console.log(mixed)

  const l = 512 / 4
  const { bitStream } = consumer(p)
  const directions = ['up', 'down', 'left', 'right']
  const randomDirections = Array(l).fill(0).map(() => directions[bitStream.readBits(2, false)])
  console.log(randomDirections)
})

// shuffle
// views
