
export const isValidBpm = value => {
  const bpm = Number(value)

  return (
    Number.isFinite(bpm) &&
    bpm >= 30 &&
    bpm <= 220
  )
}
