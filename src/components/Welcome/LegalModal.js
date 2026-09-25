import { LEGAL_CONTENT } from './LegalContent'

export default function LegalModal({ type, onClose, isDark }) {
  if (!type) return null

  const primaryText = isDark ? '#FFFFFF' : '#172033'
  const secondaryText = isDark ? '#A7B0C0' : '#667085'
  const surface = isDark ? '#171D2A' : '#FFFFFF'
  const border = isDark ? '#2A3147' : '#DCE3EE'

  const current = LEGAL_CONTENT[type]
  if (!current) return null

  return (
    <div
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 12000,
        background: 'rgba(13,27,62,.58)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`legal-${type}-title`}
        style={{
          width: 'min(720px, 100%)',
          maxHeight: '86vh',
          overflowY: 'auto',
          borderRadius: 18,
          padding: 24,
          background: surface,
          border: `1px solid ${border}`,
          boxShadow: '0 24px 80px rgba(0,0,0,.28)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 14,
            alignItems: 'flex-start',
            marginBottom: 16,
          }}
        >
          <div>
            <div
              id={`legal-${type}-title`}
              style={{
                fontSize: 21,
                fontWeight: 700,
                color: primaryText,
              }}
            >
              {current.title}
            </div>

            <div
              style={{
                marginTop: 5,
                fontSize: 12,
                lineHeight: 1.6,
                color: secondaryText,
              }}
            >
              {current.intro}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={`Close ${current.title}`}
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              border: `1px solid ${border}`,
              background: 'transparent',
              color: primaryText,
              cursor: 'pointer',
              fontSize: 18,
            }}
          >
            ×
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 15,
          }}
        >
          {current.sections.map(([heading, body]) => (
            <div key={heading}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: primaryText,
                  marginBottom: 5,
                }}
              >
                {heading}
              </div>

              <div
                style={{
                  fontSize: 12,
                  lineHeight: 1.7,
                  color: secondaryText,
                }}
              >
                {body}
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: 20,
            paddingTop: 16,
            borderTop: `1px solid ${border}`,
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              border: 0,
              borderRadius: 10,
              padding: '10px 16px',
              background: '#1A5FFF',
              color: '#FFFFFF',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}