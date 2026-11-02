// A helper in another module: the reason it is not folded travels with its value.
export function shared(tone: string) {
  const upper = tone.toUpperCase()
  return { color: upper }
}
