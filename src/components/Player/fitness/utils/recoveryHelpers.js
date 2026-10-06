export function recoverySuggestion(
  score,
  recovery,
  activeInjuries,
  weeklyMinutes
) {
  if (!recovery) {
    return 'Add a recovery check-in to get a training suggestion.'
  }

  if (activeInjuries > 0 && score < 60) {
    return 'Rest or light mobility is suggested because recovery is low and there is an active injury.'
  }

  if (activeInjuries > 0) {
    return 'Train carefully and avoid loading the injured area.'
  }

  if (score < 55) {
    return 'Rest is suggested today. Sleep more and avoid high intensity training.'
  }

  if (score < 75) {
    return 'Light to moderate training is suitable. Avoid pushing too hard.'
  }

  if (weeklyMinutes < 120) {
    return 'Recovery looks good. You can add a normal training session.'
  }

  return 'Recovery looks good. Normal badminton training should be okay today.'
}
