const fs = require('fs')
const path = require('path')

const projectRoot = __dirname
const srcRoot = path.join(projectRoot, 'src')

if (!fs.existsSync(srcRoot)) {
  console.error(
    'Cannot find src folder. Put this file beside package.json.'
  )
  process.exit(1)
}

const replacements = {
  '\u00c2\u00b7': '\u00b7',
  '\u00c2\u00a9': '\u00a9',
  '\u00c2\u00ae': '\u00ae',

  '\u00e2\u20ac\u201d': '\u2014',
  '\u00e2\u20ac\u201c': '\u2013',
  '\u00e2\u2020\u2019': '\u2192',
  '\u00e2\u2020\u0090': '\u2190',
  '\u00e2\u20ac\u00b9': '\u2039',
  '\u00e2\u20ac\u00ba': '\u203a',
  '\u00e2\u20ac\u00a6': '\u2026',
  '\u00e2\u0153\u2022': '\u2715',
  '\u00e2\u0153\u201c': '\u2713',
  '\u00e2\u0153\u201d': '\u2714',
  '\u00e2\u2014\u008f': '\u25cf',
  '\u00e2\u20ac\u00a2': '\u2022',

  '\u00c3\u2014': '\u00d7',
  '\u00c3\u00b7': '\u00f7',

  '\ud83d\udd14': '\ud83d\udd14',
  '\ud83e\udd1d': '\ud83e\udd1d',
  '\ud83c\udff8': '\ud83c\udff8',
  '\ud83c\udfaf': '\ud83c\udfaf',
  '\ud83d\udc64': '\ud83d\udc64',
  '\ud83d\udc65': '\ud83d\udc65',
  '\ud83d\udcc5': '\ud83d\udcc5',
  '\ud83d\udcca': '\ud83d\udcca',
  '\ud83d\udcc8': '\ud83d\udcc8',
  '\ud83d\udcc9': '\ud83d\udcc9',
  '\ud83d\udcac': '\ud83d\udcac',
  '\ud83d\udcaa': '\ud83d\udcaa',
  '\ud83d\udcb0': '\ud83d\udcb0',
  '\ud83c\udfc6': '\ud83c\udfc6',
  '\ud83d\udd0d': '\ud83d\udd0d',
  '\ud83d\udccd': '\ud83d\udccd',
  '\ud83d\udd52': '\ud83d\udd52',
  '\ud83d\udeaa': '\ud83d\udeaa',
  '\ud83d\ude80': '\ud83d\ude80',
  '\ud83e\uddd1': '\ud83e\uddd1',
  '\ud83c\udf93': '\ud83c\udf93',
  '\ud83c\udf1f': '\ud83c\udf1f',
}

const allowedExtensions = new Set([
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.css',
  '.json',
])

function walk(folder) {
  const entries = fs.readdirSync(folder, {
    withFileTypes: true,
  })

  const files = []

  for (const entry of entries) {
    const fullPath = path.join(folder, entry.name)

    if (entry.isDirectory()) {
      files.push(...walk(fullPath))
      continue
    }

    const extension = path.extname(entry.name).toLowerCase()

    if (allowedExtensions.has(extension)) {
      files.push(fullPath)
    }
  }

  return files
}

let changedCount = 0
const files = walk(srcRoot)

for (const file of files) {
  let text = fs.readFileSync(file, 'utf8')

  if (
    text.length > 0 &&
    text.charCodeAt(0) === 0xfeff
  ) {
    text = text.slice(1)
  }

  const original = text

  for (const [bad, good] of Object.entries(replacements)) {
    text = text.split(bad).join(good)
  }

  text = text.replace(
    /\u00c2(?=[\s.,:;!?()[\]{}'"`<>/\\|-])/g,
    ''
  )

  fs.writeFileSync(file, text, {
    encoding: 'utf8',
  })

  if (text !== original) {
    changedCount += 1

    console.log(
      `Cleaned: ${path.relative(projectRoot, file)}`
    )
  }
}

console.log('')
console.log(`Finished. Files changed: ${changedCount}`)
console.log(
  'All scanned files were saved as UTF-8 without BOM.'
)
console.log('Now restart with: npm.cmd start')