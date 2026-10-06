import { useEffect } from 'react'
import styles from '../../../Layout/Pages.module.css'

const clamp = (n, min = 0, max = 100) =>
  Math.max(min, Math.min(max, Number(n) || 0))


function ModalShell({
  title,
  children,
  onClose,
  maxWidth = 560,
}) {
  return (
    <div
      className={styles.modalOverlay}
      onClick={event =>
        event.target === event.currentTarget && onClose()
      }
    >
      <div
        className={`${styles.modal} fitness-mobile-modal`}
        style={{
          width: 'min(92vw, 100%)',
          maxWidth,
        }}
      >
        <div className={styles.modalHead}>
          <div className={styles.modalTitle}>{title}</div>
          <button
            type="button"
            className={styles.modalClose}
            onClick={onClose}
          >
            ×
          </button>
        </div>

        {children}
      </div>
    </div>
  )
}


function FormActions({
  onSave,
  onClose,
  onDelete,
  saving,
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: 8,
      }}
    >
      {onDelete ? (
        <button
          type="button"
          onClick={onDelete}
          disabled={saving}
          style={{
            padding: '9px 16px',
            borderRadius: 10,
            border: '1.5px solid #FCA5A5',
            background: '#FEF2F2',
            color: '#EF4444',
            fontWeight: 700,
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          Delete
        </button>
      ) : (
        <div />
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          type="button"
          className={styles.btnOutline}
          onClick={onClose}
          disabled={saving}
        >
          Cancel
        </button>

        <button
          type="button"
          className={styles.btnPrimary}
          onClick={onSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  )
}

export default function FitnessTestModal({
  title,
  form,
  onChange,
  onSave,
  onClose,
  onDelete,
  saving,
  currentScore = 0,
}) {
  const safeCurrentScore = clamp(currentScore)

  const adjustmentAmount = Math.max(
    0,
    Number(form.adjustmentAmount) || 0
  )

  const adjustmentSign =
    form.adjustmentSign === '-' ? '-' : '+'

  const updatedScore = clamp(
    safeCurrentScore +
      (adjustmentSign === '-'
        ? -adjustmentAmount
        : adjustmentAmount)
  )

  useEffect(() => {
    if (!form.indicator) {
      if (Number(form.score) !== 0) {
        onChange('score', 0)
      }
      return
    }

    if (Number(form.score) !== updatedScore) {
      onChange('score', updatedScore)
    }
  }, [
    form.indicator,
    form.score,
    onChange,
    updatedScore,
  ])

  const handleIndicatorChange = value => {
    onChange('indicator', value)
    onChange('adjustmentSign', '+')
    onChange('adjustmentAmount', 0)
  }

  return (
    <ModalShell title={title} onClose={onClose}>
      <div
        className="fitness-test-top-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 14,
        }}
      >
        <div className={styles.formRow}>
          <label className={styles.formLabel}>Date</label>
          <input
            className={styles.formInput}
            type="date"
            value={form.date}
            onChange={e => onChange('date', e.target.value)}
          />
        </div>

        <div className={styles.formRow}>
          <label className={styles.formLabel}>Fitness Indicator</label>
          <select
            className={styles.formSelect}
            value={form.indicator}
            onChange={e => handleIndicatorChange(e.target.value)}
          >
            <option value="">Select indicator</option>
            <option>Endurance</option>
            <option>Speed</option>
            <option>Strength</option>
            <option value="Agility">Agility</option>
          </select>
        </div>
      </div>

      <div className={styles.formRow}>
        <label className={styles.formLabel}>Test name</label>
        <input
          className={styles.formInput}
          placeholder="e.g. 20m Sprint"
          value={form.test}
          onChange={e => onChange('test', e.target.value)}
        />
      </div>

      <div className={styles.formRow}>
        <label className={styles.formLabel}>Result</label>
        <input
          className={styles.formInput}
          placeholder="e.g. 3.35 s"
          value={form.result}
          onChange={e => onChange('result', e.target.value)}
        />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1.25fr 1fr',
          gap: 12,
          alignItems: 'end',
        }}
      >
        <div className={styles.formRow}>
          <label className={styles.formLabel}>Current Score</label>
          <div
            style={{
              minHeight: 44,
              display: 'flex',
              alignItems: 'center',
              padding: '0 14px',
              borderRadius: 10,
              border: '1px solid var(--line, #E8EEF8)',
              background: 'var(--soft, #F7F9FF)',
              fontWeight: 700,
            }}
          >
            {form.indicator ? `${safeCurrentScore} / 100` : '—'}
          </div>
        </div>

        <div className={styles.formRow}>
          <label className={styles.formLabel}>Score Adjustment</label>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '74px 1fr',
              gap: 8,
            }}
          >
            <select
              className={styles.formSelect}
              value={adjustmentSign}
              disabled={!form.indicator}
              onChange={e =>
                onChange('adjustmentSign', e.target.value)
              }
            >
              <option value="+">+</option>
              <option value="-">−</option>
            </select>

            <input
              className={styles.formInput}
              type="number"
              min="0"
              max="100"
              step="1"
              inputMode="numeric"
              disabled={!form.indicator}
              value={form.adjustmentAmount ?? 0}
              onChange={e => {
                const amount = Math.max(
                  0,
                  Math.min(100, Number(e.target.value) || 0)
                )

                onChange('adjustmentAmount', amount)
              }}
            />
          </div>

          <div
            style={{
              marginTop: 5,
              fontSize: 12,
              lineHeight: 1.45,
              color: '#8892A4',
            }}
          >
            Enter how many points to add or subtract.
          </div>
        </div>

        <div className={styles.formRow}>
          <label className={styles.formLabel}>Updated Score</label>
          <div
            style={{
              minHeight: 44,
              display: 'flex',
              alignItems: 'center',
              padding: '0 14px',
              borderRadius: 10,
              border: '1px solid #BFD1FF',
              background: '#F4F7FF',
              color: '#1A5FFF',
              fontWeight: 800,
            }}
          >
            {form.indicator ? `${updatedScore} / 100` : '—'}
          </div>
        </div>
      </div>

      {form.indicator && (
        <div
          style={{
            marginBottom: 12,
            padding: '9px 11px',
            borderRadius: 10,
            background: 'var(--soft, #F7F9FF)',
            color: '#64748B',
            fontSize: 13,
          }}
        >
          {safeCurrentScore} {adjustmentSign} {adjustmentAmount}
          {' = '}
          <strong>{updatedScore} / 100</strong>
        </div>
      )}

      <FormActions
        onSave={onSave}
        onClose={onClose}
        onDelete={onDelete}
        saving={saving}
      />
    </ModalShell>
  )
}
