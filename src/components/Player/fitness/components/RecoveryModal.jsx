import { useEffect, useRef, useState } from 'react'
import { createWorker, PSM } from 'tesseract.js'
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

const recognizeOcr = async (
  worker,
  source
) => {
  /*
   * Send generated canvases to Tesseract as PNG Blob URLs.
   * Blob URLs are more memory-friendly than very large data URLs.
   */
  if (
    typeof HTMLCanvasElement !==
      'undefined' &&
    source instanceof
      HTMLCanvasElement
  ) {
    const blob =
      await new Promise(
        (resolve, reject) => {
          source.toBlob(
            result => {
              if (result) {
                resolve(result)
              } else {
                reject(
                  new Error(
                    'Unable to prepare OCR image.'
                  )
                )
              }
            },
            'image/png',
            1
          )
        }
      )

    const blobUrl =
      URL.createObjectURL(blob)

    try {
      return await worker.recognize(
        blobUrl
      )
    } finally {
      URL.revokeObjectURL(
        blobUrl
      )
    }
  }

  return worker.recognize(
    source
  )
}

export default function RecoveryModal({
  title,
  form,
  onChange,
  onSave,
  onClose,
  onDelete,
  saving,
}) {
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrMessage, setOcrMessage] = useState('')
  const [detectedBpm, setDetectedBpm] = useState(null)
  const [imagePreview, setImagePreview] = useState('')
  const [uploadedBpmFile, setUploadedBpmFile] = useState(null)
  const [cropMode, setCropMode] = useState(false)
  const [cropRect, setCropRect] = useState(null)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraError, setCameraError] = useState('')

  const fileInputRef = useRef(null)
  const cameraVideoRef = useRef(null)
  const cameraCanvasRef = useRef(null)
  const cameraStreamRef = useRef(null)
  const cropImageRef = useRef(null)
  const cropDragStartRef = useRef(null)
  const ocrCancelledRef = useRef(false)

  useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview)
      }
    }
  }, [imagePreview])

  useEffect(() => {
    if (
      cameraOpen &&
      cameraVideoRef.current &&
      cameraStreamRef.current
    ) {
      cameraVideoRef.current.srcObject =
        cameraStreamRef.current

      cameraVideoRef.current
        .play()
        .catch(() => {})
    }
  }, [cameraOpen])

  useEffect(() => {
    return () => {
      if (cameraStreamRef.current) {
        cameraStreamRef.current
          .getTracks()
          .forEach(track => track.stop())

        cameraStreamRef.current = null
      }
    }
  }, [])

  const isValidBpm = value => {
    const bpm = Number(value)

    return (
      Number.isFinite(bpm) &&
      bpm >= 30 &&
      bpm <= 220
    )
  }

  const createCrop = (
    bitmap,
    {
      x,
      y,
      width,
      height,
      scale = 5,
      mode = 'normal',
    }
  ) => {
    const sx = Math.max(
      0,
      Math.round(bitmap.width * x)
    )
    const sy = Math.max(
      0,
      Math.round(bitmap.height * y)
    )
    const sw = Math.max(
      1,
      Math.min(
        bitmap.width - sx,
        Math.round(bitmap.width * width)
      )
    )
    const sh = Math.max(
      1,
      Math.min(
        bitmap.height - sy,
        Math.round(bitmap.height * height)
      )
    )

    /*
     * Do not let OCR crops become extremely large.
     *
     * A 3000-4000px phone photo combined with scale 18/24/28 can
     * otherwise create a temporary canvas over 10,000-20,000px wide,
     * which can make Tesseract fail with:
     * "Error attempting to read image."
     *
     * Keep the requested zoom, but cap the longest output side.
     */
    const requestedWidth =
      Math.max(
        1,
        Math.round(sw * scale)
      )

    const requestedHeight =
      Math.max(
        1,
        Math.round(sh * scale)
      )

    const MAX_OCR_SIDE = 2400

    const outputScale =
      Math.min(
        1,
        MAX_OCR_SIDE /
          Math.max(
            requestedWidth,
            requestedHeight
          )
      )

    const canvas =
      document.createElement('canvas')

    canvas.width =
      Math.max(
        1,
        Math.round(
          requestedWidth *
            outputScale
        )
      )

    canvas.height =
      Math.max(
        1,
        Math.round(
          requestedHeight *
            outputScale
        )
      )

    const ctx = canvas.getContext('2d', {
      willReadFrequently: true,
    })

    ctx.imageSmoothingEnabled = false

    ctx.drawImage(
      bitmap,
      sx,
      sy,
      sw,
      sh,
      0,
      0,
      canvas.width,
      canvas.height
    )

    if (mode === 'normal') {
      return canvas
    }

    const imageData = ctx.getImageData(
      0,
      0,
      canvas.width,
      canvas.height
    )

    const pixels = imageData.data

    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i]
      const g = pixels[i + 1]
      const b = pixels[i + 2]

      let value = 0

      if (mode === 'gray') {
        const gray =
          r * 0.299 +
          g * 0.587 +
          b * 0.114

        value = Math.max(
          0,
          Math.min(
            255,
            Math.round(
              (gray - 128) * 1.8 + 128
            )
          )
        )
      }

      if (mode === 'bright') {
        const gray =
          r * 0.299 +
          g * 0.587 +
          b * 0.114

        value =
          gray >= 145
            ? 255
            : 0
      }

      if (mode === 'red') {
        const redDifference =
          r - (g + b) / 2

        value = Math.max(
          0,
          Math.min(
            255,
            Math.round(
              redDifference * 3.2 + 128
            )
          )
        )
      }

      if (mode === 'softBright') {
        const gray =
          r * 0.299 +
          g * 0.587 +
          b * 0.114

        value =
          gray >= 90
            ? 255
            : 0
      }

      if (mode === 'invertGray') {
        const gray =
          r * 0.299 +
          g * 0.587 +
          b * 0.114

        const contrasted = Math.max(
          0,
          Math.min(
            255,
            Math.round(
              (gray - 92) * 2.25 + 128
            )
          )
        )

        value = 255 - contrasted
      }

      if (mode === 'pinkMask') {
        /*
         * Smartwatch heart-rate values are commonly drawn in
         * pink/red on a nearly black display. Convert those pixels
         * to solid black on a white background so Tesseract sees
         * clean number shapes instead of tiny coloured anti-aliased
         * pixels.
         */
        const maxOther = Math.max(g, b)
        const redLead = r - g
        const pinkBrightness = r + b

        const isPinkOrRed =
          r >= 105 &&
          (
            redLead >= 20 ||
            (
              r >= 145 &&
              pinkBrightness >= 260 &&
              r >= maxOther - 10
            )
          )

        value =
          isPinkOrRed
            ? 0
            : 255
      }

      pixels[i] = value
      pixels[i + 1] = value
      pixels[i + 2] = value
      pixels[i + 3] = 255
    }

    ctx.putImageData(
      imageData,
      0,
      0
    )

    return canvas
  }

  const extractContextCandidates = (
    text,
    source = 'full'
  ) => {
    if (!text) return []

    const raw = String(text)
      .replace(/\r/g, '\n')
      .replace(/[|]/g, 'I')
      .trim()

    const candidates = []

    const add = (
      value,
      score,
      reason,
      labelled = false
    ) => {
      const bpm = Number(value)

      if (!isValidBpm(bpm)) {
        return
      }

      candidates.push({
        value: bpm,
        score,
        reason,
        source,
        labelled,
      })
    }

    const sanitised = raw
      .replace(
        /\b(?:max(?:imum)?|min(?:imum)?)\b[^\n]{0,20}\b\d{2,3}\b/gi,
        ' '
      )
      .replace(
        /\b\d{2,3}\s*kcal\b/gi,
        ' '
      )
      .replace(
        /\b\d{1,3}\s*%/g,
        ' '
      )
      .replace(
        /\b\d{1,2}\s*:\s*\d{2}\b/g,
        ' '
      )

    for (
      const match of sanitised.matchAll(
        /\baverage\b[^\d]{0,30}(\d{2,3})\s*bpm\b/gi
      )
    ) {
      add(
        match[1],
        2000,
        'Average + BPM',
        true
      )
    }

    for (
      const match of sanitised.matchAll(
        /\b(\d{2,3})\s*bpm\b/gi
      )
    ) {
      const start = Math.max(
        0,
        match.index - 25
      )
      const end = Math.min(
        sanitised.length,
        match.index +
          match[0].length +
          35
      )

      const nearbyMatchText =
        sanitised.slice(
          start,
          end
        )

      if (
        /\bago\b|\bprevious\b|\bhistory\b/i.test(
          nearbyMatchText
        )
      ) {
        console.log(
          'Rejecting historical BPM:',
          nearbyMatchText
        )
        continue
      }

      add(
        match[1],
        1800,
        'number directly beside BPM',
        true
      )
    }

    for (
      const match of sanitised.matchAll(
        /\bheart\s*rate\b(?:(?!\bmax\b|\bmin\b)[\s\S]){0,80}?(\d{2,3})\b/gi
      )
    ) {
      add(
        match[1],
        1500,
        'first number after Heart Rate',
        true
      )
    }

    for (
      const match of sanitised.matchAll(
        /\bpulse\b(?:(?!\bmax\b|\bmin\b)[\s\S]){0,50}?(\d{2,3})\b/gi
      )
    ) {
      add(
        match[1],
        1400,
        'first number after Pulse',
        true
      )
    }

    const lines = sanitised
      .split(/\n+/)
      .map(line =>
        line.replace(/\s+/g, ' ').trim()
      )
      .filter(Boolean)

    lines.forEach((line, index) => {
      const previous = lines[index - 1] || ''
      const next = lines[index + 1] || ''
      const nearby =
        `${previous} ${line} ${next}`

      if (
        /\bkcal\b|\bcalories?\b|\bduration\b|\bmax(?:imum)?\b|\bmin(?:imum)?\b|\bago\b|\bprevious\b|\bhistory\b/i.test(
          nearby
        )
      ) {
        return
      }

      const values = [
        ...line.matchAll(
          /\b(\d{2,3})\b/g
        ),
      ]
        .map(match => Number(match[1]))
        .filter(isValidBpm)

      if (!values.length) {
        return
      }

      if (values.length >= 3) {
        return
      }

      values.forEach(value => {
        let score =
          source === 'summary'
            ? 900
            : source === 'full'
              ? 120
              : 400

        let labelled = false
        let reason =
          `${source} contextual number`

        if (/\baverage\b/i.test(nearby)) {
          score += 700
          labelled = true
          reason = 'number near Average'
        }

        if (/\bbpm\b/i.test(nearby)) {
          score += 800
          labelled = true
          reason = 'number near BPM'
        }

        if (
          /heart\s*rate|\bpulse\b|\bHR\b/i.test(
            nearby
          )
        ) {
          score += 550
          labelled = true
          reason =
            'number near Heart Rate'
        }

        add(
          value,
          score,
          reason,
          labelled
        )
      })
    })

    return candidates
  }

  const extractDigitCandidates = (
    text,
    source,
    confidence = 0,
    baseScore = 500
  ) => {
    const compact = String(text || '')
      .replace(/\s+/g, '')
      .trim()

    /*
     * On tiny seven-segment / smartwatch digits Tesseract can read
     * an 8 as B. Correct that only inside short digit-like tokens.
     */
    const digitLike = compact.replace(
      /(?<=[0-9B])B(?=[0-9B])|^B(?=[0-9B])|(?<=[0-9B])B$/g,
      '8'
    )

    const values = (
      digitLike.match(/\d{2,3}/g) ||
      []
    )
      .map(Number)
      .filter(isValidBpm)

    return values.map(value => ({
      value,
      score:
        baseScore +
        Math.max(
          0,
          Number(confidence) || 0
        ) *
          0.6,
      reason:
        `${source} digit-only OCR`,
      source,
      labelled: false,
    }))
  }

  const detectWatchScreenBounds = bitmap => {
    /*
     * Auto-find the smartwatch display using the red/pink pixels that
     * normally belong to the heart-rate UI. This avoids requiring the
     * user to crop the photo manually.
     *
     * The returned values are normalised 0..1 coordinates so they can
     * be passed directly into createCrop().
     */
    const maxSide = 320
    const scale = Math.min(
      1,
      maxSide /
        Math.max(
          bitmap.width,
          bitmap.height
        )
    )

    const width = Math.max(
      1,
      Math.round(bitmap.width * scale)
    )
    const height = Math.max(
      1,
      Math.round(bitmap.height * scale)
    )

    const canvas =
      document.createElement('canvas')

    canvas.width = width
    canvas.height = height

    const ctx = canvas.getContext('2d', {
      willReadFrequently: true,
    })

    ctx.drawImage(
      bitmap,
      0,
      0,
      width,
      height
    )

    const imageData =
      ctx.getImageData(
        0,
        0,
        width,
        height
      )

    const pixels =
      imageData.data

    const points = []

    /*
     * Ignore the very outer edge of the photo. Pink/red pixels there
     * are more likely to be unrelated objects or UI artefacts.
     */
    const minX =
      Math.round(width * 0.08)
    const maxX =
      Math.round(width * 0.92)
    const minY =
      Math.round(height * 0.06)
    const maxY =
      Math.round(height * 0.94)

    for (
      let y = minY;
      y < maxY;
      y += 2
    ) {
      for (
        let x = minX;
        x < maxX;
        x += 2
      ) {
        const index =
          (y * width + x) * 4

        const r = pixels[index]
        const g = pixels[index + 1]
        const b = pixels[index + 2]

        const looksPinkOrRed =
          r >= 105 &&
          r >= g + 18 &&
          (
            r + b >= 220 ||
            r >= 155
          )

        if (looksPinkOrRed) {
          points.push({ x, y })
        }
      }
    }

    if (points.length < 3) {
      return null
    }

    /*
     * Use the median pink/red point instead of the extreme bounding
     * box. This is resistant to one stray red pixel elsewhere.
     */
    const xs =
      points
        .map(point => point.x)
        .sort((a, b) => a - b)

    const ys =
      points
        .map(point => point.y)
        .sort((a, b) => a - b)

    const median = values =>
      values[
        Math.floor(
          values.length / 2
        )
      ]

    const centerX =
      median(xs)
    const centerY =
      median(ys)

    /*
     * Estimate the spread of relevant red pixels around the median,
     * then expand substantially to include the whole watch display.
     */
    const nearby = points.filter(
      point =>
        Math.abs(
          point.x - centerX
        ) <= width * 0.22 &&
        Math.abs(
          point.y - centerY
        ) <= height * 0.28
    )

    const active =
      nearby.length >= 3
        ? nearby
        : points

    const activeXs =
      active.map(point => point.x)
    const activeYs =
      active.map(point => point.y)

    const left =
      Math.min(...activeXs)
    const right =
      Math.max(...activeXs)
    const top =
      Math.min(...activeYs)
    const bottom =
      Math.max(...activeYs)

    const pinkWidth =
      Math.max(
        8,
        right - left
      )
    const pinkHeight =
      Math.max(
        8,
        bottom - top
      )

    /*
     * The red graph/heart elements occupy only part of the display,
     * so expand generously around them.
     */
    let cropWidth =
      Math.max(
        pinkWidth * 2.7,
        width * 0.18
      )

    let cropHeight =
      Math.max(
        pinkHeight * 2.9,
        height * 0.24
      )

    /*
     * Smartwatch displays are usually taller than they are wide.
     */
    cropHeight =
      Math.max(
        cropHeight,
        cropWidth * 1.05
      )

    cropWidth =
      Math.min(
        cropWidth,
        width * 0.55
      )

    cropHeight =
      Math.min(
        cropHeight,
        height * 0.62
      )

    let cropX =
      centerX -
      cropWidth / 2

    let cropY =
      centerY -
      cropHeight / 2

    cropX =
      Math.max(
        0,
        Math.min(
          width - cropWidth,
          cropX
        )
      )

    cropY =
      Math.max(
        0,
        Math.min(
          height - cropHeight,
          cropY
        )
      )

    const bounds = {
      x: cropX / width,
      y: cropY / height,
      width:
        cropWidth / width,
      height:
        cropHeight / height,
    }

    console.log(
      'AUTO WATCH BOUNDS:',
      bounds
    )

    return bounds
  }

  const createRotatedCanvas = (
    sourceCanvas,
    degrees = 180
  ) => {
    const canvas =
      document.createElement('canvas')

    const normalized =
      ((degrees % 360) + 360) % 360

    if (
      normalized === 90 ||
      normalized === 270
    ) {
      canvas.width =
        sourceCanvas.height
      canvas.height =
        sourceCanvas.width
    } else {
      canvas.width =
        sourceCanvas.width
      canvas.height =
        sourceCanvas.height
    }

    const ctx =
      canvas.getContext('2d', {
        willReadFrequently: true,
      })

    ctx.translate(
      canvas.width / 2,
      canvas.height / 2
    )

    ctx.rotate(
      normalized *
        Math.PI /
        180
    )

    ctx.drawImage(
      sourceCanvas,
      -sourceCanvas.width / 2,
      -sourceCanvas.height / 2
    )

    return canvas
  }

  const scanAutoZoomedWatch = async (
    worker,
    bitmap,
    candidates
  ) => {
    const bounds =
      detectWatchScreenBounds(
        bitmap
      )

    if (!bounds) {
      return null
    }

    /*
     * Auto-zoom the detected watch area before OCR. This is the step
     * that replaces manual cropping by the user.
     */
    const baseNormal =
      createCrop(
        bitmap,
        {
          ...bounds,
          scale: 10,
          mode: 'normal',
        }
      )

    const baseGray =
      createCrop(
        bitmap,
        {
          ...bounds,
          scale: 10,
          mode: 'gray',
        }
      )

    const basePink =
      createCrop(
        bitmap,
        {
          ...bounds,
          scale: 10,
          mode: 'pinkMask',
        }
      )

    const versions = [
      {
        name: 'auto-normal',
        canvas: baseNormal,
      },
      {
        name: 'auto-gray',
        canvas: baseGray,
      },
      {
        name: 'auto-pink',
        canvas: basePink,
      },

      /*
       * People often photograph the watch upside down. Tesseract is
       * much more accurate if we explicitly try a 180° copy.
       */
      {
        name:
          'auto-normal-180',
        canvas:
          createRotatedCanvas(
            baseNormal,
            180
          ),
      },
      {
        name:
          'auto-gray-180',
        canvas:
          createRotatedCanvas(
            baseGray,
            180
          ),
      },
      {
        name:
          'auto-pink-180',
        canvas:
          createRotatedCanvas(
            basePink,
            180
          ),
      },
    ]

    const hits = new Map()

    for (const version of versions) {
      await worker.setParameters({
        tessedit_pageseg_mode:
          PSM.SPARSE_TEXT,
        tessedit_char_whitelist:
          '0123456789',
        user_defined_dpi:
          '300',
      })

      const result =
        await recognizeOcr(worker, 
          version.canvas
        )

      const found =
        extractDigitCandidates(
          result.data.text,
          version.name,
          result.data.confidence,
          1850
        )

      console.log(
        `AUTO ZOOM ${version.name}:`,
        result.data.text,
        result.data.confidence
      )

      for (const item of found) {
        candidates.push(item)

        const current =
          hits.get(item.value) || {
            value: item.value,
            hits: 0,
            bestConfidence: 0,
            sources: new Set(),
          }

        current.hits += 1
        current.bestConfidence =
          Math.max(
            current.bestConfidence,
            Number(
              result.data.confidence
            ) || 0
          )
        current.sources.add(
          version.name
        )

        hits.set(
          item.value,
          current
        )
      }
    }

    const ranked =
      [...hits.values()]
        .sort((a, b) => {
          if (
            b.hits !== a.hits
          ) {
            return (
              b.hits - a.hits
            )
          }

          return (
            b.bestConfidence -
            a.bestConfidence
          )
        })

    console.log(
      'AUTO ZOOM BPM RANKING:',
      ranked
    )

    /*
     * Require agreement across two processed versions before the
     * automatic crop is allowed to fill the form.
     */
    const agreed =
      ranked.find(
        item =>
          item.hits >= 2
      )

    if (agreed) {
      return agreed.value
    }

    const strongSingle =
      ranked.find(
        item =>
          item.hits === 1 &&
          item.bestConfidence >= 78
      )

    return (
      strongSingle?.value ||
      null
    )
  }

  const scanPrimaryTopBpm = async (
    worker,
    bitmap,
    candidates
  ) => {
    /*
     * The actual BPM on smartwatch screens is usually the large
     * number near the top of the display. Small numbers lower down
     * are often graph scale labels, min/max values or historical
     * readings. Scan narrow top-display bands first and give them
     * much higher authority.
     */
    const topRegions = [
      {
        name: 'top-bpm-a',
        x: 0.34,
        y: 0.18,
        width: 0.32,
        height: 0.16,
      },
      {
        name: 'top-bpm-b',
        x: 0.34,
        y: 0.22,
        width: 0.32,
        height: 0.16,
      },
      {
        name: 'top-bpm-c',
        x: 0.36,
        y: 0.26,
        width: 0.28,
        height: 0.15,
      },
      {
        name: 'top-bpm-tight-a',
        x: 0.40,
        y: 0.20,
        width: 0.20,
        height: 0.13,
      },
      {
        name: 'top-bpm-tight-b',
        x: 0.40,
        y: 0.24,
        width: 0.20,
        height: 0.13,
      },
      {
        name: 'top-bpm-tight-c',
        x: 0.40,
        y: 0.28,
        width: 0.20,
        height: 0.13,
      },
    ]

    const modes = [
      'pinkMask',
      'invertGray',
      'gray',
      'normal',
    ]

    const hits = new Map()

    for (const region of topRegions) {
      for (const mode of modes) {
        await worker.setParameters({
          tessedit_pageseg_mode:
            PSM.SINGLE_WORD,
          tessedit_char_whitelist:
            '0123456789',
          user_defined_dpi:
            '300',
        })

        const crop =
          createCrop(
            bitmap,
            {
              ...region,
              scale:
                region.name.includes('tight')
                  ? 28
                  : 22,
              mode,
            }
          )

        const result =
          await recognizeOcr(worker, crop)

        const found =
          extractDigitCandidates(
            result.data.text,
            `${region.name}-${mode}`,
            result.data.confidence,
            2400
          )

        console.log(
          `PRIMARY TOP BPM ${region.name} ${mode}:`,
          result.data.text,
          result.data.confidence
        )

        for (const item of found) {
          candidates.push({
            ...item,
            score: item.score + 300,
          })

          const current =
            hits.get(item.value) || {
              value: item.value,
              hits: 0,
              bestConfidence: 0,
              sources: new Set(),
            }

          current.hits += 1
          current.bestConfidence = Math.max(
            current.bestConfidence,
            Number(result.data.confidence) || 0
          )
          current.sources.add(
            `${region.name}-${mode}`
          )

          hits.set(item.value, current)
        }
      }
    }

    const ranked =
      [...hits.values()]
        .sort((a, b) => {
          if (b.hits !== a.hits) {
            return b.hits - a.hits
          }

          return (
            b.bestConfidence -
            a.bestConfidence
          )
        })

    console.log(
      'PRIMARY TOP BPM RANKING:',
      ranked
    )

    /*
     * If the same top-display value appears at least twice, trust it
     * immediately. This stops graph tick values such as 100/150/200
     * from winning simply because they appear multiple times lower
     * on the screen.
     */
    const repeatedTop =
      ranked.find(
        item => item.hits >= 2
      )

    if (repeatedTop) {
      return repeatedTop.value
    }

    /*
     * A single very confident read from a tight top crop is also
     * acceptable.
     */
    const strongTop =
      ranked.find(
        item =>
          item.hits === 1 &&
          item.bestConfidence >= 72
      )

    return strongTop?.value || null
  }

  const scanFocusedWatchBpm = async (
    worker,
    bitmap,
    candidates
  ) => {
    /*
     * Do not rely on one fixed crop. Phone photos vary in framing,
     * tilt and distance, so scan several overlapping areas around
     * the central watch display.
     */
    const regions = [
      {
        name: 'watch-upper',
        x: 0.32,
        y: 0.22,
        width: 0.36,
        height: 0.24,
      },
      {
        name: 'watch-upper-mid',
        x: 0.32,
        y: 0.29,
        width: 0.36,
        height: 0.24,
      },
      {
        name: 'watch-center',
        x: 0.32,
        y: 0.36,
        width: 0.36,
        height: 0.24,
      },
      {
        name: 'watch-center-low',
        x: 0.32,
        y: 0.43,
        width: 0.36,
        height: 0.23,
      },
      {
        name: 'watch-tight-upper',
        x: 0.39,
        y: 0.27,
        width: 0.22,
        height: 0.18,
      },
      {
        name: 'watch-tight-mid',
        x: 0.39,
        y: 0.34,
        width: 0.22,
        height: 0.18,
      },
      {
        name: 'watch-tight-low',
        x: 0.39,
        y: 0.41,
        width: 0.22,
        height: 0.18,
      },
    ]

    const modes = [
      'pinkMask',
      'invertGray',
      'gray',
      'normal',
    ]

    await worker.setParameters({
      tessedit_pageseg_mode:
        PSM.SINGLE_WORD,
      tessedit_char_whitelist:
        '0123456789',
      user_defined_dpi:
        '300',
    })

    const focusedHits = new Map()

    for (const region of regions) {
      for (const mode of modes) {
        await worker.setParameters({
          tessedit_pageseg_mode:
            region.name.includes('tight')
              ? PSM.SINGLE_WORD
              : PSM.SINGLE_LINE,
          tessedit_char_whitelist:
            '0123456789',
          user_defined_dpi:
            '300',
        })

        const crop =
          createCrop(
            bitmap,
            {
              ...region,
              scale:
                region.name.includes('tight')
                  ? 24
                  : 18,
              mode,
            }
          )

        const result =
          await recognizeOcr(worker, crop)

        const extracted =
          extractDigitCandidates(
            result.data.text,
            `${region.name}-${mode}`,
            result.data.confidence,
            1050
          )

        console.log(
          `BPM ${region.name} ${mode}:`,
          result.data.text,
          result.data.confidence
        )

        for (const item of extracted) {
          /*
           * Prefer likely resting-heart-rate values, but still allow
           * higher values because the upload may be from a general
           * heart-rate screen rather than a true resting measurement.
           */
          let bonus = 0

          if (item.value >= 45 && item.value <= 120) {
            bonus += 120
          }

          candidates.push({
            ...item,
            score: item.score + bonus,
          })

          const current =
            focusedHits.get(item.value) || {
              value: item.value,
              hits: 0,
              sources: new Set(),
              bestConfidence: 0,
            }

          current.hits += 1
          current.sources.add(
            `${region.name}-${mode}`
          )
          current.bestConfidence =
            Math.max(
              current.bestConfidence,
              Number(result.data.confidence) || 0
            )

          focusedHits.set(
            item.value,
            current
          )
        }
      }
    }

    const rankedFocused =
      [...focusedHits.values()]
        .sort((a, b) => {
          if (b.hits !== a.hits) {
            return b.hits - a.hits
          }

          return (
            b.bestConfidence -
            a.bestConfidence
          )
        })

    console.log(
      'FOCUSED BPM HITS:',
      rankedFocused
    )

    /*
     * Two independent focused reads of the same value are enough.
     * This is much safer than accepting a single broad OCR number.
     */
    const agreed =
      rankedFocused.find(
        item => item.hits >= 2
      )

    if (agreed) {
      return agreed.value
    }

    /*
     * If only one focused crop reads a value, only trust it when
     * Tesseract confidence is reasonably strong.
     */
    const strongSingle =
      rankedFocused.find(
        item =>
          item.hits === 1 &&
          item.bestConfidence >= 62
      )

    return strongSingle?.value || null
  }

  const chooseBestBpm = candidates => {
    if (!candidates.length) {
      return null
    }

    const grouped = new Map()

    candidates.forEach(candidate => {
      const current =
        grouped.get(candidate.value) || {
          value: candidate.value,
          bestScore: -Infinity,
          hits: 0,
          sources: new Set(),
          labelledHits: 0,
          reasons: [],
        }

      current.bestScore =
        Math.max(
          current.bestScore,
          candidate.score
        )
      current.hits += 1
      current.sources.add(
        candidate.source
      )

      if (candidate.labelled) {
        current.labelledHits += 1
      }

      current.reasons.push(
        `${candidate.source}: ${candidate.reason}`
      )

      grouped.set(
        candidate.value,
        current
      )
    })

    const ranked = [
      ...grouped.values(),
    ]
      .map(item => ({
        ...item,
        finalScore:
          item.bestScore +
          Math.min(
            450,
            (item.sources.size - 1) *
              150
          ) +
          Math.min(
            300,
            item.labelledHits * 150
          ) +
          Math.min(
            120,
            (item.hits - 1) * 35
          ),
      }))
      .sort(
        (a, b) =>
          b.finalScore -
          a.finalScore
      )

    console.log(
      'BPM FINAL RANKING:',
      ranked
    )

    const labelledWinner =
      ranked.find(
        item =>
          item.labelledHits > 0 &&
          item.bestScore >= 1400
      )

    if (labelledWinner) {
      return labelledWinner.value
    }

    const best = ranked[0]
    const second = ranked[1]

    if (!best) return null

    if (
      best.sources.size >= 2 &&
      (
        !second ||
        best.finalScore -
          second.finalScore >=
          80
      )
    ) {
      return best.value
    }

    /*
     * A tightly focused BPM crop is intentionally given a score
     * above 1400. If one of those focused scans finds a clear
     * 2-3 digit number, allow it to win even when another image
     * preprocessing pass did not recognise the same digits.
     *
     * This prevents a clear large BPM such as 88, 120 or 198 from
     * being rejected simply because only one focused OCR pass read it.
     */
    if (
      best.bestScore >= 1400 &&
      (
        !second ||
        best.finalScore -
          second.finalScore >=
          120
      )
    ) {
      return best.value
    }

    return null
  }

  const clamp01 = value =>
    Math.max(
      0,
      Math.min(
        1,
        Number(value) || 0
      )
    )

  const getCropPointer = event => {
    const image =
      cropImageRef.current

    if (!image) return null

    const rect =
      image.getBoundingClientRect()

    if (
      !rect.width ||
      !rect.height
    ) {
      return null
    }

    return {
      x: clamp01(
        (event.clientX - rect.left) /
          rect.width
      ),
      y: clamp01(
        (event.clientY - rect.top) /
          rect.height
      ),
    }
  }

  const handleCropPointerDown = event => {
    const point =
      getCropPointer(event)

    if (!point) return

    event.preventDefault()

    cropDragStartRef.current =
      point

    setCropRect({
      x: point.x,
      y: point.y,
      width: 0,
      height: 0,
    })

    try {
      event.currentTarget
        .setPointerCapture(
          event.pointerId
        )
    } catch {
      // Pointer capture is optional.
    }
  }

  const handleCropPointerMove = event => {
    const start =
      cropDragStartRef.current

    if (!start) return

    const point =
      getCropPointer(event)

    if (!point) return

    const x =
      Math.min(
        start.x,
        point.x
      )
    const y =
      Math.min(
        start.y,
        point.y
      )

    const width =
      Math.abs(
        point.x - start.x
      )
    const height =
      Math.abs(
        point.y - start.y
      )

    setCropRect({
      x,
      y,
      width,
      height,
    })
  }

  const handleCropPointerUp = event => {
    cropDragStartRef.current =
      null

    try {
      event.currentTarget
        .releasePointerCapture(
          event.pointerId
        )
    } catch {
      // Pointer capture is optional.
    }
  }

  const scanManualCrop = async () => {
    if (
      !uploadedBpmFile ||
      !cropRect
    ) {
      setOcrMessage(
        'Drag a box around the watch screen first.'
      )
      return
    }

    if (
      cropRect.width < 0.025 ||
      cropRect.height < 0.025
    ) {
      setOcrMessage(
        'The crop area is too small. Drag a box around the watch screen.'
      )
      return
    }

    ocrCancelledRef.current = false

    setOcrLoading(true)
    setDetectedBpm(null)
    setOcrMessage(
      'Scanning the selected watch area...'
    )

    let worker = null
    let bitmap = null

    try {
      bitmap =
        await createImageBitmap(
          uploadedBpmFile
        )

      worker =
        await createWorker('eng')

      /*
       * Convert a region expressed relative to the selected crop
       * into coordinates relative to the original uploaded image.
       *
       * This means the user can crop around the WHOLE watch screen.
       * We then automatically inspect smaller zones inside that crop.
       */
      const subCrop = ({
        x,
        y,
        width,
        height,
      }) => ({
        x:
          cropRect.x +
          cropRect.width * x,
        y:
          cropRect.y +
          cropRect.height * y,
        width:
          cropRect.width *
          width,
        height:
          cropRect.height *
          height,
      })

      /*
       * Search several overlapping zones inside the user's crop.
       *
       * The main BPM number on smartwatch displays is usually near
       * one end of the screen. Because the watch may be upside down,
       * we scan both the upper and lower portions.
       */
      const regions = [
        {
          name: 'whole',
          ...subCrop({
            x: 0,
            y: 0,
            width: 1,
            height: 1,
          }),
          priority: 250,
        },
        {
          name: 'upper-half',
          ...subCrop({
            x: 0.08,
            y: 0.02,
            width: 0.84,
            height: 0.48,
          }),
          priority: 550,
        },
        {
          name: 'lower-half',
          ...subCrop({
            x: 0.08,
            y: 0.50,
            width: 0.84,
            height: 0.48,
          }),
          priority: 550,
        },
        {
          name: 'upper-number',
          ...subCrop({
            x: 0.18,
            y: 0.02,
            width: 0.64,
            height: 0.30,
          }),
          priority: 900,
        },
        {
          name: 'lower-number',
          ...subCrop({
            x: 0.18,
            y: 0.68,
            width: 0.64,
            height: 0.30,
          }),
          priority: 900,
        },
        {
          name: 'center-upper',
          ...subCrop({
            x: 0.16,
            y: 0.18,
            width: 0.68,
            height: 0.30,
          }),
          priority: 650,
        },
        {
          name: 'center-lower',
          ...subCrop({
            x: 0.16,
            y: 0.52,
            width: 0.68,
            height: 0.30,
          }),
          priority: 650,
        },
      ]

      const modes = [
        'pinkMask',
        'gray',
        'normal',
      ]

      const manualCandidates = []

      for (const region of regions) {
        for (const mode of modes) {
          const crop =
            createCrop(
              bitmap,
              {
                x: region.x,
                y: region.y,
                width:
                  region.width,
                height:
                  region.height,
                scale:
                  region.name ===
                    'whole'
                    ? 10
                    : 18,
                mode,
              }
            )

          const versions = [
            {
              name:
                `${region.name}-${mode}`,
              canvas: crop,
            },
            {
              name:
                `${region.name}-${mode}-180`,
              canvas:
                createRotatedCanvas(
                  crop,
                  180
                ),
            },
          ]

          for (
            const version of versions
          ) {
            await worker.setParameters({
              tessedit_pageseg_mode:
                region.name ===
                  'whole'
                  ? PSM.SPARSE_TEXT
                  : PSM.SINGLE_LINE,
              tessedit_char_whitelist:
                '0123456789',
              user_defined_dpi:
                '300',
            })

            const result =
              await recognizeOcr(
                worker,
                version.canvas
              )

            console.log(
              `MANUAL SMART CROP ${version.name}:`,
              result.data.text,
              result.data.confidence
            )

            const found =
              extractDigitCandidates(
                result.data.text,
                version.name,
                result.data.confidence,
                2200 +
                  region.priority
              )

            /*
             * Prefer realistic resting BPM values slightly, but do
             * not exclude higher readings because users may upload
             * a general heart-rate screen.
             */
            manualCandidates.push(
              ...found.map(item => ({
                ...item,
                score:
                  item.score +
                  (
                    item.value >= 45 &&
                    item.value <= 120
                      ? 180
                      : 0
                  ),
              }))
            )
          }
        }
      }

      const grouped =
        new Map()

      manualCandidates.forEach(
        candidate => {
          const current =
            grouped.get(
              candidate.value
            ) || {
              value:
                candidate.value,
              hits: 0,
              bestScore:
                -Infinity,
              sources:
                new Set(),
            }

          current.hits += 1

          current.bestScore =
            Math.max(
              current.bestScore,
              candidate.score
            )

          current.sources.add(
            candidate.source
          )

          grouped.set(
            candidate.value,
            current
          )
        }
      )

      const ranked =
        [...grouped.values()]
          .map(item => ({
            ...item,
            finalScore:
              item.bestScore +
              Math.min(
                900,
                (item.sources.size -
                  1) *
                  180
              ) +
              Math.min(
                500,
                (item.hits - 1) *
                  90
              ),
          }))
          .sort(
            (a, b) =>
              b.finalScore -
              a.finalScore
          )

      console.log(
        'MANUAL SMART CROP BPM RANKING:',
        ranked
      )

      const best =
        ranked[0]

      const second =
        ranked[1]

      let bpm = null

      /*
       * Tight upper/lower BPM zones receive a much larger base score,
       * so the main large number should outrank graph labels and
       * secondary values even when the user selected the whole watch.
       */
      if (
        best &&
        (
          best.hits >= 2 ||
          !second ||
          best.finalScore -
            second.finalScore >=
            140
        )
      ) {
        bpm =
          best.value
      }

      if (
        !bpm ||
        !isValidBpm(bpm)
      ) {
        setOcrMessage(
          'Could not identify the main BPM number. Try selecting the watch screen more closely, but you do not need to crop only the digits.'
        )
        return
      }

      if (
        ocrCancelledRef.current
      ) {
        return
      }

      setDetectedBpm(bpm)
      onChange('hr', bpm)

      setOcrMessage(
        `BPM detected from crop: ${bpm} BPM. Please verify the value before saving.`
      )

      setCropMode(false)
    } catch (error) {
      if (
        !ocrCancelledRef.current
      ) {
        console.error(
          'Manual BPM crop OCR error:',
          error
        )

        setOcrMessage(
          'Unable to scan the cropped watch area. Please try again or enter the BPM manually.'
        )
      }
    } finally {
      if (bitmap) {
        bitmap.close()
      }

      if (worker) {
        try {
          await worker.terminate()
        } catch (error) {
          console.error(
            'Failed to terminate crop OCR worker:',
            error
          )
        }
      }

      setOcrLoading(false)
    }
  }

  const stopBpmCamera = () => {
    if (cameraVideoRef.current) {
      cameraVideoRef.current.pause()
      cameraVideoRef.current.srcObject = null
    }

    if (cameraStreamRef.current) {
      cameraStreamRef.current
        .getTracks()
        .forEach(track => track.stop())

      cameraStreamRef.current = null
    }

    setCameraOpen(false)
  }

  const startBpmCamera = async () => {
    setCameraError('')

    if (
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      setCameraError(
        'Camera access is not supported in this browser. Use Upload BPM Image instead.'
      )
      return
    }

    stopBpmCamera()

    try {
      const stream =
        await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: {
              ideal: 'environment',
            },
          },
          audio: false,
        })

      cameraStreamRef.current = stream
      setCameraOpen(true)
    } catch (error) {
      console.error(
        'Unable to open BPM camera:',
        error
      )

      setCameraError(
        window.isSecureContext
          ? 'Camera permission was blocked or the camera is unavailable.'
          : 'Camera access requires HTTPS. Open ShuttleTrack using the deployed HTTPS link.'
      )
    }
  }

  const captureBpmPhoto = async () => {
    const video = cameraVideoRef.current
    const canvas = cameraCanvasRef.current

    if (!video || !canvas) {
      setCameraError(
        'Camera is not ready yet. Please try again.'
      )
      return
    }

    const width =
      video.videoWidth ||
      video.clientWidth

    const height =
      video.videoHeight ||
      video.clientHeight

    if (!width || !height) {
      setCameraError(
        'Camera is still starting. Please wait a moment and try again.'
      )
      return
    }

    canvas.width = width
    canvas.height = height

    const ctx =
      canvas.getContext('2d')

    ctx.drawImage(
      video,
      0,
      0,
      width,
      height
    )

    const blob =
      await new Promise(resolve => {
        canvas.toBlob(
          resolve,
          'image/jpeg',
          0.92
        )
      })

    if (!blob) {
      setCameraError(
        'Unable to capture the photo. Please try again.'
      )
      return
    }

    const file =
      new File(
        [blob],
        `bpm-${Date.now()}.jpg`,
        {
          type: 'image/jpeg',
        }
      )

    stopBpmCamera()

    await handleBpmImage({
      target: {
        files: [file],
        value: '',
      },
    })
  }

  const handleBpmImage = async event => {
    const file =
      event.target.files?.[0]

    if (!file) return

    if (
      !file.type.startsWith(
        'image/'
      )
    ) {
      setOcrMessage(
        'Please upload an image file.'
      )
      return
    }

    if (
      file.size >
      10 * 1024 * 1024
    ) {
      setOcrMessage(
        'Please choose an image smaller than 10 MB.'
      )
      return
    }

    if (imagePreview) {
      URL.revokeObjectURL(
        imagePreview
      )
    }

    ocrCancelledRef.current = false

    setImagePreview(
      URL.createObjectURL(file)
    )
    setUploadedBpmFile(file)
    setCropMode(false)
    setCropRect(null)
    setDetectedBpm(null)
    setOcrMessage(
      'Scanning image for heart rate...'
    )
    setOcrLoading(true)

    let worker = null
    let bitmap = null

    try {
      bitmap =
        await createImageBitmap(file)

      worker =
        await createWorker('eng')

      const candidates = []

      await worker.setParameters({
        tessedit_pageseg_mode:
          PSM.SPARSE_TEXT,
        preserve_interword_spaces:
          '1',
        user_defined_dpi:
          '300',
      })

      const fullResult =
        await recognizeOcr(worker, file)

      console.log(
        'BPM FULL:',
        fullResult.data.text
      )

      candidates.push(
        ...extractContextCandidates(
          fullResult.data.text,
          'full'
        )
      )

      let bpm =
        chooseBestBpm(candidates)

      if (!bpm) {
        const summaryCrop =
          createCrop(
            bitmap,
            {
              x: 0.03,
              y: 0.72,
              width: 0.94,
              height: 0.20,
              scale: 4,
            }
          )

        const summaryResult =
          await recognizeOcr(worker, 
            summaryCrop
          )

        console.log(
          'BPM SUMMARY:',
          summaryResult.data.text
        )

        candidates.push(
          ...extractContextCandidates(
            summaryResult.data.text,
            'summary'
          )
        )

        bpm =
          chooseBestBpm(candidates)
      }

      await worker.setParameters({
        tessedit_pageseg_mode:
          PSM.SPARSE_TEXT,
        tessedit_char_whitelist:
          '0123456789',
        user_defined_dpi:
          '300',
      })

      /*
       * AUTO CROP / AUTO ZOOM
       *
       * Find the watch display from its pink/red UI pixels, enlarge it
       * automatically and also test a 180-degree copy. The user no
       * longer needs to crop the source image manually.
       */
      if (!bpm) {
        bpm =
          await scanAutoZoomedWatch(
            worker,
            bitmap,
            candidates
          )
      }

      /*
       * If automatic localisation did not produce a reliable value,
       * use the older fixed-position top BPM scan as a fallback.
       */
      if (!bpm) {
        bpm =
          await scanPrimaryTopBpm(
            worker,
            bitmap,
            candidates
          )
      }

      /*
       * If the main number was not readable, fall back to broader
       * overlapping watch-screen scans.
       */
      if (!bpm) {
        bpm =
          await scanFocusedWatchBpm(
            worker,
            bitmap,
            candidates
          )
      }

      /*
       * Return to sparse digit mode for the broader fallback crops.
       */
      await worker.setParameters({
        tessedit_pageseg_mode:
          PSM.SPARSE_TEXT,
        tessedit_char_whitelist:
          '0123456789',
        user_defined_dpi:
          '300',
      })

      if (!bpm) {
        const watchCrop =
          createCrop(
            bitmap,
            {
              x: 0.32,
              y: 0.25,
              width: 0.36,
              height: 0.50,
              scale: 8,
              mode: 'normal',
            }
          )

        const watchResult =
          await recognizeOcr(worker, 
            watchCrop
          )

        candidates.push(
          ...extractDigitCandidates(
            watchResult.data.text,
            'watch-normal',
            watchResult.data.confidence,
            650
          )
        )
      }

      if (!bpm) {
        const watchGrayCrop =
          createCrop(
            bitmap,
            {
              x: 0.32,
              y: 0.25,
              width: 0.36,
              height: 0.50,
              scale: 8,
              mode: 'gray',
            }
          )

        const watchGrayResult =
          await recognizeOcr(worker, 
            watchGrayCrop
          )

        candidates.push(
          ...extractDigitCandidates(
            watchGrayResult.data.text,
            'watch-gray',
            watchGrayResult.data.confidence,
            650
          )
        )

        bpm =
          chooseBestBpm(candidates)
      }

      if (!bpm) {
        const centerCrop =
          createCrop(
            bitmap,
            {
              x: 0.23,
              y: 0.23,
              width: 0.54,
              height: 0.35,
              scale: 6,
              mode: 'normal',
            }
          )

        const centerResult =
          await recognizeOcr(worker, 
            centerCrop
          )

        candidates.push(
          ...extractDigitCandidates(
            centerResult.data.text,
            'center-normal',
            centerResult.data.confidence,
            620
          )
        )
      }

      if (!bpm) {
        const redCrop =
          createCrop(
            bitmap,
            {
              x: 0.23,
              y: 0.23,
              width: 0.54,
              height: 0.35,
              scale: 6,
              mode: 'red',
            }
          )

        const redResult =
          await recognizeOcr(worker, 
            redCrop
          )

        candidates.push(
          ...extractDigitCandidates(
            redResult.data.text,
            'center-red',
            redResult.data.confidence,
            700
          )
        )

        bpm =
          chooseBestBpm(candidates)
      }

      if (!bpm) {
        const lowerCrop =
          createCrop(
            bitmap,
            {
              x: 0.28,
              y: 0.44,
              width: 0.44,
              height: 0.29,
              scale: 7,
              mode: 'normal',
            }
          )

        const lowerResult =
          await recognizeOcr(worker, 
            lowerCrop
          )

        candidates.push(
          ...extractDigitCandidates(
            lowerResult.data.text,
            'lower-normal',
            lowerResult.data.confidence,
            700
          )
        )
      }

      if (!bpm) {
        const lowerBrightCrop =
          createCrop(
            bitmap,
            {
              x: 0.28,
              y: 0.44,
              width: 0.44,
              height: 0.29,
              scale: 7,
              mode: 'bright',
            }
          )

        const lowerBrightResult =
          await recognizeOcr(worker, 
            lowerBrightCrop
          )

        candidates.push(
          ...extractDigitCandidates(
            lowerBrightResult.data.text,
            'lower-bright',
            lowerBrightResult.data.confidence,
            700
          )
        )

        bpm =
          chooseBestBpm(candidates)
      }

      {
        const microWatchNormal =
          createCrop(
            bitmap,
            {
              x: 0.405,
              y: 0.335,
              width: 0.19,
              height: 0.13,
              scale: 18,
              mode: 'normal',
            }
          )

        await worker.setParameters({
          tessedit_pageseg_mode:
            PSM.SINGLE_WORD,
          tessedit_char_whitelist:
            '0123456789',
          user_defined_dpi:
            '300',
        })

        const microWatchNormalResult =
          await recognizeOcr(worker, 
            microWatchNormal
          )

        const microWatchGray =
          createCrop(
            bitmap,
            {
              x: 0.405,
              y: 0.335,
              width: 0.19,
              height: 0.13,
              scale: 18,
              mode: 'gray',
            }
          )

        const microWatchGrayResult =
          await recognizeOcr(worker, 
            microWatchGray
          )

        const normalValues =
          extractDigitCandidates(
            microWatchNormalResult.data.text,
            'micro-watch-normal',
            microWatchNormalResult.data.confidence,
            900
          )

        const grayValues =
          extractDigitCandidates(
            microWatchGrayResult.data.text,
            'micro-watch-gray',
            microWatchGrayResult.data.confidence,
            900
          )

        candidates.push(
          ...normalValues,
          ...grayValues
        )

        console.log(
          'MICRO WATCH NORMAL:',
          microWatchNormalResult.data.text,
          microWatchNormalResult.data.confidence
        )

        console.log(
          'MICRO WATCH GRAY:',
          microWatchGrayResult.data.text,
          microWatchGrayResult.data.confidence
        )

        const normalBpms =
          normalValues.map(
            item => item.value
          )

        const grayBpms =
          grayValues.map(
            item => item.value
          )

        const microAgreement =
          normalBpms.find(value =>
            grayBpms.includes(value)
          )

        if (microAgreement) {
          bpm = microAgreement
        }
      }

      if (!bpm) {
        const heartDigitsNormal =
          createCrop(
            bitmap,
            {
              x: 0.365,
              y: 0.61,
              width: 0.27,
              height: 0.105,
              scale: 12,
              mode: 'normal',
            }
          )

        await worker.setParameters({
          tessedit_pageseg_mode:
            PSM.SINGLE_WORD,
          tessedit_char_whitelist:
            '0123456789',
          user_defined_dpi:
            '300',
        })

        const heartDigitsNormalResult =
          await recognizeOcr(worker, 
            heartDigitsNormal
          )

        candidates.push(
          ...extractDigitCandidates(
            heartDigitsNormalResult.data.text,
            'heart-digits-normal',
            heartDigitsNormalResult.data.confidence,
            980
          )
        )

        const heartDigitsGray =
          createCrop(
            bitmap,
            {
              x: 0.365,
              y: 0.61,
              width: 0.27,
              height: 0.105,
              scale: 12,
              mode: 'gray',
            }
          )

        const heartDigitsGrayResult =
          await recognizeOcr(worker, 
            heartDigitsGray
          )

        candidates.push(
          ...extractDigitCandidates(
            heartDigitsGrayResult.data.text,
            'heart-digits-gray',
            heartDigitsGrayResult.data.confidence,
            980
          )
        )

        const heartNormalValues =
          extractDigitCandidates(
            heartDigitsNormalResult.data.text,
            'heart-normal-check',
            heartDigitsNormalResult.data.confidence,
            0
          ).map(item => item.value)

        const heartGrayValues =
          extractDigitCandidates(
            heartDigitsGrayResult.data.text,
            'heart-gray-check',
            heartDigitsGrayResult.data.confidence,
            0
          ).map(item => item.value)

        const heartAgreement =
          heartNormalValues.find(value =>
            heartGrayValues.includes(value)
          )

        if (heartAgreement) {
          bpm = heartAgreement
        }
      }

      if (!bpm) {
        bpm =
          chooseBestBpm(candidates)
      }

      console.log(
        'ALL BPM CANDIDATES:',
        candidates
      )

      console.log(
        'FINAL BPM:',
        bpm
      )

      if (!bpm) {
        setOcrMessage(
          'Could not detect a reliable BPM value. Please try another screenshot or enter it manually.'
        )
        return
      }

      if (ocrCancelledRef.current) {
        return
      }

      setDetectedBpm(bpm)
      onChange('hr', bpm)

      setOcrMessage(
        `BPM detected successfully: ${bpm} BPM. Please verify the value before saving.`
      )
    } catch (error) {
      if (!ocrCancelledRef.current) {
        console.error(
          'BPM OCR error:',
          error
        )

        setOcrMessage(
          'Unable to scan this image. Please try another image or enter the BPM manually.'
        )
      }
    } finally {
      if (bitmap) {
        bitmap.close()
      }

      if (worker) {
        try {
          await worker.terminate()
        } catch (error) {
          console.error(
            'Failed to terminate OCR worker:',
            error
          )
        }
      }

      setOcrLoading(false)

      if (event.target) {
        event.target.value = ''
      }
    }
  }

  const clearBpmImage = () => {
    stopBpmCamera()

    if (imagePreview) {
      URL.revokeObjectURL(imagePreview)
    }

    setImagePreview('')
    setUploadedBpmFile(null)
    setCropMode(false)
    setCropRect(null)
    cropDragStartRef.current = null
    setDetectedBpm(null)
    setOcrMessage('')
  }

  const handleClose = () => {
    ocrCancelledRef.current = true
    stopBpmCamera()
    onClose()
  }

  const hrValue = form.hr === null || form.hr === undefined
    ? ''
    : form.hr

  return (
    <ModalShell title={title} onClose={handleClose}>
      <div
        className="fitness-recovery-top-grid"
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
          <label className={styles.formLabel}>
            Resting heart rate
          </label>

          <div style={{ position: 'relative' }}>
            <input
              className={styles.formInput}
              type="number"
              min="30"
              max="220"
              inputMode="numeric"
              placeholder="e.g. 62"
              value={hrValue}
              onChange={e => {
                setDetectedBpm(null)
                onChange('hr', e.target.value)
              }}
              style={{ paddingRight: 58 }}
            />

            <span
              style={{
                position: 'absolute',
                right: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: 13,
                fontWeight: 700,
                color: '#8892A4',
                pointerEvents: 'none',
              }}
            >
              BPM
            </span>
          </div>
        </div>
      </div>

      <div className={styles.formRow}>
        <label className={styles.formLabel}>
          Scan or upload BPM image
        </label>

        {/* Existing image picker for screenshots/gallery/desktop. */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleBpmImage}
          style={{ display: 'none' }}
        />

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 8,
          }}
        >
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={startBpmCamera}
            disabled={ocrLoading || saving || cameraOpen}
            style={{
              width: '100%',
              minHeight: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            📷 Snap & Detect BPM
          </button>

          <button
            type="button"
            className={styles.btnOutline}
            onClick={() => fileInputRef.current?.click()}
            disabled={ocrLoading || saving || cameraOpen}
            style={{
              width: '100%',
              minHeight: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              borderStyle: 'dashed',
            }}
          >
            🖼️ Upload BPM Image
          </button>
        </div>

        <div
          style={{
            marginTop: 5,
            fontSize: 12,
            color: '#8892A4',
            lineHeight: 1.45,
          }}
        >
          Snap a photo or upload an image to detect BPM automatically.
        </div>

        {cameraError && (
          <div
            style={{
              marginTop: 8,
              padding: '9px 11px',
              borderRadius: 9,
              border: '1px solid #FECACA',
              background: '#FEF2F2',
              color: '#B91C1C',
              fontSize: 13,
              lineHeight: 1.45,
              fontWeight: 700,
            }}
          >
            {cameraError}
          </div>
        )}

        {cameraOpen && (
          <div
            style={{
              marginTop: 10,
              padding: 10,
              borderRadius: 12,
              border: '1px solid #DCE5F5',
              background: '#F7F9FF',
            }}
          >
            <div
              style={{
                marginBottom: 8,
                fontSize: 13,
                fontWeight: 700,
                color: '#0D1B3E',
              }}
            >
              Point the camera at the BPM reading
            </div>

            <video
              ref={cameraVideoRef}
              autoPlay
              playsInline
              muted
              style={{
                display: 'block',
                width: '100%',
                maxHeight: 360,
                objectFit: 'cover',
                borderRadius: 10,
                background: '#000000',
              }}
            />

            <canvas
              ref={cameraCanvasRef}
              style={{ display: 'none' }}
            />

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 8,
                marginTop: 10,
              }}
            >
              <button
                type="button"
                className={styles.btnOutline}
                onClick={stopBpmCamera}
                disabled={ocrLoading}
              >
                Cancel Camera
              </button>

              <button
                type="button"
                className={styles.btnPrimary}
                onClick={captureBpmPhoto}
                disabled={ocrLoading}
              >
                📸 Capture & Scan
              </button>
            </div>
          </div>
        )}

        {imagePreview && (
          <div
            style={{
              marginTop: 10,
              padding: 10,
              borderRadius: 12,
              border: '1px solid #E8EEF8',
              background: '#F7F9FF',
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
                  color: '#0D1B3E',
                }}
              >
                Uploaded image
              </span>

              <button
                type="button"
                onClick={clearBpmImage}
                disabled={ocrLoading}
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
              src={imagePreview}
              alt="Uploaded BPM reading"
              style={{
                display: 'block',
                width: '100%',
                maxHeight: 180,
                objectFit: 'contain',
                borderRadius: 8,
                background: '#FFFFFF',
              }}
            />
          </div>
        )}

        {imagePreview && (
          <div
            style={{
              marginTop: 8,
            }}
          >
            <button
              type="button"
              className={styles.btnOutline}
              disabled={
                ocrLoading ||
                saving
              }
              onClick={() => {
                setCropMode(
                  current =>
                    !current
                )

                setCropRect(null)
              }}
              style={{
                width: '100%',
                minHeight: 38,
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              {cropMode
                ? 'Cancel Crop'
                : 'Crop & Rescan BPM'}
            </button>
          </div>
        )}

        {imagePreview &&
          cropMode && (
            <div
              style={{
                marginTop: 10,
                padding: 12,
                borderRadius: 12,
                border:
                  '1px solid #DCE5F5',
                background:
                  '#F7F9FF',
              }}
            >
              <div
                style={{
                  marginBottom: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  color:
                    '#0D1B3E',
                }}
              >
                Drag a box around the watch screen
              </div>

              <div
                style={{
                  marginBottom: 10,
                  fontSize: 12,
                  lineHeight: 1.45,
                  color:
                    '#64748B',
                }}
              >
                Select the watch display area. You do not need to crop tightly
                around only the BPM digits; the scanner will search inside
                your selected area automatically.
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent:
                    'center',
                  overflow: 'hidden',
                  borderRadius: 10,
                  background:
                    '#FFFFFF',
                  border:
                    '1px solid #E8EEF8',
                  padding: 8,
                }}
              >
                <div
                  onPointerDown={
                    handleCropPointerDown
                  }
                  onPointerMove={
                    handleCropPointerMove
                  }
                  onPointerUp={
                    handleCropPointerUp
                  }
                  onPointerCancel={
                    handleCropPointerUp
                  }
                  style={{
                    position:
                      'relative',
                    display:
                      'inline-block',
                    maxWidth:
                      '100%',
                    touchAction:
                      'none',
                    cursor:
                      'crosshair',
                    userSelect:
                      'none',
                  }}
                >
                  <img
                    ref={
                      cropImageRef
                    }
                    src={
                      imagePreview
                    }
                    alt="Select BPM crop area"
                    draggable="false"
                    style={{
                      display:
                        'block',
                      maxWidth:
                        '100%',
                      maxHeight:
                        330,
                      width:
                        'auto',
                      height:
                        'auto',
                      pointerEvents:
                        'none',
                      userSelect:
                        'none',
                    }}
                  />

                  {cropRect &&
                    cropRect.width >
                      0 &&
                    cropRect.height >
                      0 && (
                      <div
                        style={{
                          position:
                            'absolute',
                          left:
                            `${cropRect.x * 100}%`,
                          top:
                            `${cropRect.y * 100}%`,
                          width:
                            `${cropRect.width * 100}%`,
                          height:
                            `${cropRect.height * 100}%`,
                          border:
                            '2px solid #1A5FFF',
                          background:
                            'rgba(26,95,255,0.12)',
                          boxShadow:
                            '0 0 0 9999px rgba(15,23,42,0.35)',
                          boxSizing:
                            'border-box',
                          pointerEvents:
                            'none',
                        }}
                      />
                    )}
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent:
                    'space-between',
                  alignItems:
                    'center',
                  gap: 10,
                  marginTop: 10,
                }}
              >
                <button
                  type="button"
                  className={
                    styles.btnOutline
                  }
                  disabled={
                    ocrLoading
                  }
                  onClick={() =>
                    setCropRect(
                      null
                    )
                  }
                  style={{
                    fontSize: 13,
                  }}
                >
                  Reset Crop
                </button>

                <button
                  type="button"
                  className={
                    styles.btnPrimary
                  }
                  disabled={
                    ocrLoading ||
                    !cropRect ||
                    cropRect.width <
                      0.025 ||
                    cropRect.height <
                      0.025
                  }
                  onClick={
                    scanManualCrop
                  }
                  style={{
                    fontSize: 13,
                  }}
                >
                  {ocrLoading
                    ? 'Scanning...'
                    : 'Scan Crop'}
                </button>
              </div>
            </div>
          )}

        {ocrMessage && (
          <div
            style={{
              marginTop: 8,
              padding: '9px 11px',
              borderRadius: 9,
              background: detectedBpm
                ? '#ECFDF5'
                : '#F7F9FF',
              border: detectedBpm
                ? '1px solid #A7F3D0'
                : '1px solid #E8EEF8',
              color: detectedBpm
                ? '#047857'
                : '#64748B',
              fontSize: 13,
              lineHeight: 1.45,
              fontWeight: 700,
            }}
          >
            {ocrMessage}
          </div>
        )}
      </div>

      <div
        className="fitness-recovery-metrics-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 14,
        }}
      >
        <div className={styles.formRow}>
          <label className={styles.formLabel}>Sleep hours</label>
          <input
            className={styles.formInput}
            type="number"
            min="0"
            max="24"
            value={form.sleep}
            onChange={e => onChange('sleep', e.target.value)}
          />
        </div>

        <div className={styles.formRow}>
          <label className={styles.formLabel}>Tiredness /10</label>
          <input
            className={styles.formInput}
            type="number"
            min="1"
            max="10"
            value={form.tiredness}
            onChange={e => onChange('tiredness', e.target.value)}
          />
          <div
            style={{
              fontSize: 12,
              color: '#8892A4',
              marginTop: 4,
            }}
          >
            1 = not tired, 10 = very tired
          </div>
        </div>

        <div className={styles.formRow}>
          <label className={styles.formLabel}>Muscle ache /10</label>
          <input
            className={styles.formInput}
            type="number"
            min="1"
            max="10"
            value={form.muscleAche}
            onChange={e => onChange('muscleAche', e.target.value)}
          />
          <div
            style={{
              fontSize: 12,
              color: '#8892A4',
              marginTop: 4,
            }}
          >
            1 = no ache, 10 = very painful
          </div>
        </div>
      </div>

      <div className={styles.formRow}>
        <label className={styles.formLabel}>Notes</label>
        <textarea
          className={styles.formTextarea}
          placeholder="e.g. Slept only 6 hours, felt tired after training."
          value={form.notes}
          onChange={e => onChange('notes', e.target.value)}
        />
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 8,
        }}
      >
        {onDelete ? (
          <button
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

        <div
          style={{
            display: 'flex',
            gap: 10,
          }}
        >
          <button
            className={styles.btnOutline}
            onClick={handleClose}
            disabled={saving}
          >
            Cancel
          </button>

          <button
            className={styles.btnPrimary}
            onClick={onSave}
            disabled={saving || ocrLoading}
          >
            {saving
              ? 'Saving...'
              : ocrLoading
                ? 'Scanning...'
                : 'Save'}
          </button>
        </div>
      </div>
    </ModalShell>
  )
}
