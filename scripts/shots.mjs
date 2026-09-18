/**
 * מצלם את מסכי התצוגה ל-README.
 *
 * הצילומים נלקחים מ-src/dev/shots.jsx ולא מהאפליקציה החיה, כי הם
 * צריכים נתונים קבועים: צילום שמשתנה בכל הרצה הופך כל עדכון README
 * לרעש, וצילום מנתונים אמיתיים מפרסם את המספרים של מישהו.
 *
 *   node scripts/shots.mjs            מול שרת הפיתוח שרץ
 *   node scripts/shots.mjs 4173       מול preview
 */
import { execFile } from 'node:child_process'
import { mkdir, rm } from 'node:fs/promises'
import { promisify } from 'node:util'

const run = promisify(execFile)

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const OUT = 'docs/screens'
const PORT = process.argv[2] || '5173'

/**
 * מצלמים חלון רחב וחותכים את העמודה שבמרכז.
 *
 * .app מוגבל ל-480 וממורכז, ולכן חלון רחב נותן בדיוק את אותה פריסה
 * כמו טלפון. צילום ישיר ברוחב טלפון נחתך, כי בממשק מימין לשמאל
 * נקודת הגלילה ההתחלתית אינה בקצה שרואים.
 */
const WINDOW = '1000,950'
const COLUMN = 960
const HEIGHT = 1900

const SCREENS = [
  'login', 'home', 'types', 'month', 'reserve', 'trip', 'goal', 'sheet', 'intro',
  'profile', 'commitments', 'import',
]

await mkdir(OUT, { recursive: true })

for (const screen of SCREENS) {
  const file = `${OUT}/${screen}.png`
  await rm(file, { force: true })
  await run(CHROME, [
    '--headless',
    '--disable-gpu',
    '--hide-scrollbars',
    `--window-size=${WINDOW}`,
    '--force-device-scale-factor=2',
    `--screenshot=${file}`,
    '--virtual-time-budget=4000',
    `http://localhost:${PORT}/shots.html?s=${screen}`,
  ])
  // sips חותך מהמרכז, וזה בדיוק המקום שבו העמודה יושבת
  await run('sips', ['-c', String(HEIGHT), String(COLUMN), file, '--out', file])
  console.log(`נשמר ${file}`)
}

console.log(`\n${SCREENS.length} צילומים ב-${OUT}`)
