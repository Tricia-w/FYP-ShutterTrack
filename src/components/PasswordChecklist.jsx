import { getPasswordChecks } from '../utils/passwordValidation'

export default function PasswordChecklist({ password }) {
  const checks = getPasswordChecks(password)

  const itemStyle = (valid) => ({
    fontSize: 12,
    color: valid ? '#34D399' : '#8892A4',
    marginBottom: 4,
  })

  return (
    <div style={{ marginTop: -6, marginBottom: 14 }}>
      <p style={itemStyle(checks.length)}>
        {checks.length ? '✓' : '•'} At least 8 characters
      </p>
      <p style={itemStyle(checks.uppercase)}>
        {checks.uppercase ? '✓' : '•'} One uppercase letter
      </p>
      <p style={itemStyle(checks.lowercase)}>
        {checks.lowercase ? '✓' : '•'} One lowercase letter
      </p>
      <p style={itemStyle(checks.number)}>
        {checks.number ? '✓' : '•'} One number
      </p>
      <p style={itemStyle(checks.symbol)}>
        {checks.symbol ? '✓' : '•'} One symbol
      </p>
    </div>
  )
}