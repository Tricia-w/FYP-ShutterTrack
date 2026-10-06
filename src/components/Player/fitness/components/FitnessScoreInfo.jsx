import styles from '../../../Layout/Pages.module.css'

export default function FitnessScoreInfo({
  open,
  breakdown,
  fitnessScore = 0,
  onClose,
}) {
  if (!open) return null

  const items = breakdown?.items || []
  const average = Number(breakdown?.average) || 0

  return (
    <div
      className={styles.modalOverlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="fitness-score-info-title"
      onClick={event => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        className={styles.modal}
        style={{ maxWidth: 540 }}
      >
        <div className={styles.modalHead}>
          <div>
            <div
              id="fitness-score-info-title"
              className={styles.modalTitle}
            >
              How the Fitness Score is calculated
            </div>

            <div
              style={{
                marginTop: 5,
                fontSize: 12,
                lineHeight: 1.5,
                color: 'var(--text-muted, #8892A4)',
              }}
            >
              The score summarises the recorded fitness indicators
              into one value out of 100.
            </div>
          </div>

          <button
            type="button"
            className={styles.modalClose}
            onClick={onClose}
            aria-label="Close fitness score information"
          >
            ×
          </button>
        </div>

        <div style={{ display: 'grid', gap: 8 }}>
          {items.map(item => (
            <div
              key={item.name}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 14,
                padding: '9px 11px',
                borderRadius: 10,
                background: 'var(--soft, #F7F9FF)',
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 700 }}>
                {item.name}
              </span>

              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#1A5FFF',
                  whiteSpace: 'nowrap',
                }}
              >
                {Math.round(item.value)} /100
              </span>
            </div>
          ))}
        </div>

        {items.length > 0 && (
          <div
            style={{
              marginTop: 14,
              padding: 13,
              borderRadius: 12,
              background: 'var(--soft, #F7F9FF)',
              border: '1px solid var(--line, #E8EEF8)',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700 }}>
              Formula
            </div>

            <div
              style={{
                marginTop: 4,
                fontSize: 12,
                lineHeight: 1.6,
                color: 'var(--text-muted, #64748B)',
              }}
            >
              ({items.map(item => Math.round(item.value)).join(' + ')})
              {' ÷ '}
              {items.length}
              {' = '}
              {average.toFixed(1)}
            </div>

            <div
              style={{
                marginTop: 5,
                fontSize: 12,
                fontWeight: 700,
                color: '#1A5FFF',
              }}
            >
              Rounded Fitness Score = {fitnessScore}/100
            </div>
          </div>
        )}

        <div
          style={{
            marginTop: 12,
            fontSize: 11,
            lineHeight: 1.55,
            color: 'var(--text-muted, #8892A4)',
          }}
        >
          Endurance, Speed, Strength and Agility use the player's
          latest fitness-test records. Recovery uses the latest
          recovery check-in.
        </div>

        <div
          style={{
            marginTop: 16,
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
