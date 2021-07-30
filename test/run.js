const { fetchLast, consumer, shuffle } = require('..')

const arr = Array(91).fill(0).map((x, i) => i)

fetchLast().then(pulse => {
  console.log(pulse.value)
  return pulse
}).then(p => {
  const mixed = shuffle(arr, consumer(p))
  console.log(mixed)

  const l = 512 / 4
  const c = consumer(p)
  const directions = ['up', 'down', 'left', 'right']
  const randomDirections = Array(l).fill(0).map(() => directions[c.lessThan(4)])
  console.log(randomDirections)
})

// shuffle
// views
