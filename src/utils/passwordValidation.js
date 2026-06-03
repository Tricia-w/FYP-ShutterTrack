export function getPasswordChecks(password) {
  return {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password),
  }
}

export function isPasswordValid(password) {
  const checks = getPasswordChecks(password)
  return Object.values(checks).every(Boolean)
}

export function getPasswordError(password) {
  if (!password) return 'Password is required.'

  if (!isPasswordValid(password)) {
    return 'Password must be at least 8 characters and include uppercase, lowercase, number, and symbol.'
  }

  return ''
}