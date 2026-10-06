import { useRef } from 'react'
import styles from '../../../Layout/Pages.module.css'


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

function getBodyPointFromName(name = '') {
  const lower = String(name || '')
    .toLowerCase()
    .trim()

  if (!lower) return null

  const isLeft = /\bleft\b/.test(lower)
  const isRight = /\bright\b/.test(lower)

  const sideX = isLeft ? 50 : isRight ? 70 : 60
  const sideLabel = isLeft
    ? 'Left'
    : isRight
      ? 'Right'
      : ''

  if (
    lower.includes('head') ||
    lower.includes('forehead')
  ) {
    return {
      x: 60,
      y: 16,
      label: 'Head',
    }
  }

  if (lower.includes('neck')) {
    return {
      x: sideX,
      y: 31,
      label: sideLabel
        ? `${sideLabel} neck`
        : 'Neck',
    }
  }

  if (lower.includes('shoulder')) {
    return {
      x: isLeft ? 42 : isRight ? 78 : 60,
      y: 43,
      label: sideLabel
        ? `${sideLabel} shoulder`
        : 'Shoulder',
    }
  }

  if (
    lower.includes('upper chest') ||
    lower.includes('chest') ||
    lower.includes('pectoral')
  ) {
    return {
      x: isLeft ? 52 : isRight ? 68 : 60,
      y: 50,
      label: sideLabel
        ? `${sideLabel} upper chest`
        : 'Upper chest',
    }
  }

  if (
    lower.includes('upper arm') ||
    lower.includes('bicep') ||
    lower.includes('tricep') ||
    (
      lower.includes('arm') &&
      !lower.includes('forearm')
    )
  ) {
    return {
      x: isLeft ? 37 : isRight ? 83 : 60,
      y: 63,
      label: sideLabel
        ? `${sideLabel} upper arm`
        : 'Upper arm',
    }
  }

  if (
    lower.includes('elbow')
  ) {
    return {
      x: isLeft ? 31 : isRight ? 89 : 60,
      y: 78,
      label: sideLabel
        ? `${sideLabel} elbow`
        : 'Elbow',
    }
  }

  if (
    lower.includes('forearm')
  ) {
    return {
      x: isLeft ? 29 : isRight ? 91 : 60,
      y: 88,
      label: sideLabel
        ? `${sideLabel} forearm`
        : 'Forearm',
    }
  }

  if (
    lower.includes('wrist') ||
    lower.includes('hand') ||
    lower.includes('palm') ||
    lower.includes('finger')
  ) {
    return {
      x: isLeft ? 27 : isRight ? 93 : 60,
      y: 98,
      label: sideLabel
        ? `${sideLabel} wrist`
        : 'Wrist',
    }
  }

  if (
    lower.includes('ribs') ||
    lower.includes('rib')
  ) {
    return {
      x: isLeft ? 51 : isRight ? 69 : 60,
      y: 67,
      label: sideLabel
        ? `${sideLabel} ribs`
        : 'Ribs',
    }
  }

  if (
    lower.includes('waist') ||
    lower.includes('abdomen') ||
    lower.includes('stomach')
  ) {
    return {
      x: sideX,
      y: 86,
      label: sideLabel
        ? `${sideLabel} waist`
        : 'Waist',
    }
  }

  if (
    lower.includes('back')
  ) {
    return {
      x: sideX,
      y: lower.includes('lower') ? 86 : 66,
      label: sideLabel
        ? `${sideLabel} back`
        : lower.includes('lower')
          ? 'Lower back'
          : 'Back',
    }
  }

  if (
    lower.includes('hip') ||
    lower.includes('groin')
  ) {
    return {
      x: sideX,
      y: 94,
      label: sideLabel
        ? `${sideLabel} hip`
        : 'Hip',
    }
  }

  if (
    lower.includes('thigh') ||
    lower.includes('hamstring') ||
    lower.includes('quadricep') ||
    lower.includes('quad')
  ) {
    return {
      x: sideX,
      y: 106,
      label: sideLabel
        ? `${sideLabel} thigh`
        : 'Thigh',
    }
  }

  if (lower.includes('knee')) {
    return {
      x: sideX,
      y: 122,
      label: sideLabel
        ? `${sideLabel} knee`
        : 'Knee',
    }
  }

  if (
    lower.includes('calf') ||
    lower.includes('shin') ||
    lower.includes('lower leg')
  ) {
    return {
      x: sideX,
      y: 140,
      label: sideLabel
        ? `${sideLabel} calf`
        : 'Calf',
    }
  }

  if (
    lower.includes('ankle')
  ) {
    return {
      x: sideX,
      y: 153,
      label: sideLabel
        ? `${sideLabel} ankle`
        : 'Ankle',
    }
  }

  if (
    lower.includes('foot') ||
    lower.includes('heel') ||
    lower.includes('toe')
  ) {
    return {
      x: sideX,
      y: 160,
      label: sideLabel
        ? `${sideLabel} foot`
        : 'Foot',
    }
  }

  return null
}

function getTappedBodyLabel(x, y) {
  const px = Number(x)
  const py = Number(y)

  if (!Number.isFinite(px) || !Number.isFinite(py)) {
    return ''
  }

  const side =
    px < 55
      ? 'Left'
      : px > 65
        ? 'Right'
        : ''

  if (py <= 25) return 'Head'
  if (py <= 34) return side ? `${side} neck` : 'Neck'

  if (py <= 48) {
    if (px < 48) return 'Left shoulder'
    if (px > 72) return 'Right shoulder'
    if (px < 60) return 'Left upper chest'
    if (px > 60) return 'Right upper chest'
    return 'Upper chest'
  }

  if (py <= 68) {
    if (px < 38) return 'Left upper arm'
    if (px > 82) return 'Right upper arm'
    return side ? `${side} ribs` : 'Chest'
  }

  if (py <= 88) {
    if (px < 32) return 'Left elbow'
    if (px > 88) return 'Right elbow'
    return side ? `${side} waist` : 'Waist'
  }

  if (py <= 98) {
    if (px < 32) return 'Left wrist'
    if (px > 88) return 'Right wrist'
    return side ? `${side} hip` : 'Hip'
  }

  if (py <= 114) {
    return side ? `${side} thigh` : 'Thigh'
  }

  if (py <= 130) {
    return side ? `${side} knee` : 'Knee'
  }

  if (py <= 150) {
    return side ? `${side} calf` : 'Calf'
  }

  return side ? `${side} ankle` : 'Ankle'
}

export default function InjuryModal({
  title,
  form,
  onChange,
  onSave,
  onClose,
  onDelete,
  saving,
}) {
  const injuryImageInputRef = useRef(null)

  const handleBodyTap = event => {
    const svg = event.currentTarget
    const rect = svg.getBoundingClientRect()

    const x = ((event.clientX - rect.left) / rect.width) * 120
    const y = ((event.clientY - rect.top) / rect.height) * 170

    const roundedX = Math.round(x)
    const roundedY = Math.round(y)
    const suggestedLabel = getTappedBodyLabel(
      roundedX,
      roundedY
    )

    onChange('bodyX', roundedX)
    onChange('bodyY', roundedY)

    const currentName = String(form.name || '').trim()

    const isAutoGeneratedName =
      !currentName ||
      /^[a-z ]+\s+(pain|injury|strain|sprain)$/i.test(
        currentName
      )

    if (isAutoGeneratedName && suggestedLabel) {
      onChange('name', `${suggestedLabel} pain`)
    }
  }

  const handleInjuryImage = event => {
    const file = event.target.files?.[0]

    if (!file) return

    if (!file.type.startsWith('image/')) {
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      alert(
        'Image is too large. Please upload a photo smaller than 10 MB.'
      )
      return
    }

    if (
      form.imageUrl &&
      form.imageUrl.startsWith('blob:')
    ) {
      URL.revokeObjectURL(form.imageUrl)
    }

    onChange('imageFile', file)
    onChange('imageUrl', URL.createObjectURL(file))
    onChange('imageRemoved', false)

    if (event.target) {
      event.target.value = ''
    }
  }

  const clearInjuryImage = () => {
    if (
      form.imageUrl &&
      form.imageUrl.startsWith('blob:')
    ) {
      URL.revokeObjectURL(form.imageUrl)
    }

    onChange('imageFile', null)
    onChange('imageUrl', '')
    onChange('imagePath', '')
    onChange('imageRemoved', true)
  }

  const hasBodyPoint =
    form.bodyX !== null &&
    form.bodyX !== undefined &&
    form.bodyY !== null &&
    form.bodyY !== undefined &&
    Number.isFinite(Number(form.bodyX)) &&
    Number.isFinite(Number(form.bodyY))

  const severityColor =
    form.severity === 'Severe'
      ? '#EF4444'
      : form.severity === 'Moderate'
        ? '#F59E0B'
        : '#10B981'

  return (
    <ModalShell title={title} onClose={onClose}>
      <div className={styles.formRow}>
        <label className={styles.formLabel}>
          Injury description
        </label>
        <input
          className={styles.formInput}
          placeholder="e.g. Left wrist pain or right hip strain"
          value={form.name}
          onChange={event => {
            const value = event.target.value
            const detectedPoint =
              getBodyPointFromName(value)

            onChange('name', value)

            if (detectedPoint) {
              onChange('bodyX', detectedPoint.x)
              onChange('bodyY', detectedPoint.y)
            } else if (!value.trim()) {
              onChange('bodyX', null)
              onChange('bodyY', null)
            }
          }}
        />
        <div
          style={{
            marginTop: 5,
            fontSize: 12,
            color: 'var(--text-muted, #8892A4)',
          }}
        >
          Type a recognised body part to place the dot automatically,
          tap the body diagram, or use both.</div>
      </div>

      <div
        className="fitness-injury-meta-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 14,
        }}
      >
        <div className={styles.formRow}>
          <label className={styles.formLabel}>Date</label>
          <input
            className={styles.formInput}
            type="date"
            value={form.date}
            onChange={event =>
              onChange('date', event.target.value)
            }
          />
        </div>

        <div className={styles.formRow}>
          <label className={styles.formLabel}>Status</label>
          <select
            className={styles.formSelect}
            value={form.status}
            onChange={event =>
              onChange('status', event.target.value)
            }
          >
            <option>Monitoring</option>
            <option>Recovering</option>
            <option>Recovered</option>
          </select>
        </div>

        <div className={styles.formRow}>
          <label className={styles.formLabel}>Severity</label>
          <select
            className={styles.formSelect}
            value={form.severity}
            onChange={event =>
              onChange('severity', event.target.value)
            }
            style={{
              color: severityColor,
              fontWeight: 700,
            }}
          >
            <option value="Mild">Mild</option>
            <option value="Moderate">Moderate</option>
            <option value="Severe">Severe</option>
          </select>
        </div>
      </div>

      <div className={styles.formRow}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 10,
            marginBottom: 8,
          }}
        >
          <label
            className={styles.formLabel}
            style={{ marginBottom: 0 }}
          >
            Tap injury location optional
          </label>

          {hasBodyPoint && (
            <button
              type="button"
              className={styles.btnOutline}
              style={{
                padding: '5px 9px',
                fontSize: 12,
              }}
              onClick={() => {
                onChange('bodyX', null)
                onChange('bodyY', null)
              }}
            >
              Clear point
            </button>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            padding: 12,
            borderRadius: 14,
            border: '1px solid var(--line, #E8EEF8)',
            background: 'var(--soft, #F7F9FF)',
          }}
        >
          <div
            style={{
              position: 'relative',
              width: 180,
              height: 255,
              flexShrink: 0,
            }}
          >
            <img
              src="/humanbody.png"
              alt="Tap the human body to select the injury location"
              draggable="false"
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                objectPosition: 'center',
                pointerEvents: 'none',
                userSelect: 'none',
              }}
            />

            <svg
              viewBox="0 0 120 170"
              width="180"
              height="255"
              onClick={handleBodyTap}
              role="button"
              tabIndex={0}
              aria-label="Tap the body to select the injury location"
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                cursor: 'crosshair',
              }}
            >
              <g
                fill="none"
                stroke="transparent"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="60" cy="15" r="10" />
                <path d="M54 25 L54 33" />
                <path d="M66 25 L66 33" />
                <path d="M45 35 C50 31, 70 31, 75 35" />
                <path d="M46 36 C43 52, 42 72, 45 91" />
                <path d="M74 36 C77 52, 78 72, 75 91" />
                <path d="M45 91 C50 97, 55 100, 60 100" />
                <path d="M75 91 C70 97, 65 100, 60 100" />
                <path d="M60 35 L60 100" />
                <path d="M45 38 C34 50, 29 72, 25 96" />
                <path d="M75 38 C86 50, 91 72, 95 96" />
                <path d="M54 100 C51 116, 48 132, 45 152" />
                <path d="M45 152 L36 154" />
                <path d="M66 100 C69 116, 72 132, 75 152" />
                <path d="M75 152 L84 154" />
              </g>

              {hasBodyPoint && (
                <>
                  <circle
                    cx={Number(form.bodyX)}
                    cy={Number(form.bodyY)}
                    r="8"
                    fill="var(--card, #FFFFFF)"
                  />
                  <circle
                    cx={Number(form.bodyX)}
                    cy={Number(form.bodyY)}
                    r="5.5"
                    fill="#EF4444"
                  />
                </>
              )}
            </svg>
          </div>
        </div>

        <div
          style={{
            marginTop: 6,
            fontSize: 12,
            textAlign: 'center',
            color: 'var(--text-muted, #8892A4)',
          }}
        >
          {hasBodyPoint
            ? `Selected: ${getTappedBodyLabel(
                form.bodyX,
                form.bodyY
              ) || 'Body location'}`
            : 'No location selected yet.'}
        </div>
      </div>

      <div className={styles.formRow}>
        <label className={styles.formLabel}>
          Injury photo optional
        </label>

        <input
          ref={injuryImageInputRef}
          type="file"
          accept="image/*"
          onChange={handleInjuryImage}
          style={{ display: 'none' }}
        />

        {!form.imageUrl ? (
          <button
            type="button"
            className={styles.btnOutline}
            onClick={() =>
              injuryImageInputRef.current?.click()
            }
            disabled={saving}
            style={{
              width: '100%',
              minHeight: 44,
              borderStyle: 'dashed',
            }}
          >
            📷 Upload Injury Photo
          </button>
        ) : (
          <div
            style={{
              padding: 10,
              borderRadius: 12,
              border: '1px solid var(--line, #E8EEF8)',
              background: 'var(--soft, #F7F9FF)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 10,
                marginBottom: 8,
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: 'var(--text, #0D1B3E)',
                }}
              >
                Injury photo
              </span>

              <button
                type="button"
                onClick={clearInjuryImage}
                disabled={saving}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: '#EF4444',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Remove
              </button>
            </div>

            <img
              src={form.imageUrl}
              alt="Injury preview"
              style={{
                width: '100%',
                maxHeight: 180,
                objectFit: 'contain',
                borderRadius: 8,
                background: '#FFFFFF',
              }}
            />
          </div>
        )}

        <div
          style={{
            marginTop: 5,
            fontSize: 12,
            color: 'var(--text-muted, #8892A4)',
          }}
        >
          JPG, PNG or other image formats supported by your browser. Maximum 10 MB.
        </div>
      </div>

      <div className={styles.formRow}>
        <label className={styles.formLabel}>Notes</label>
        <textarea
          className={styles.formTextarea}
          placeholder="e.g. Pain increases during overhead shots"
          value={form.notes}
          onChange={event =>
            onChange('notes', event.target.value)
          }
        />
      </div>

      <FormActions
        onSave={onSave}
        onClose={onClose}
        onDelete={onDelete}
        saving={saving}
      />
    </ModalShell>
  )
}
