/**
 * vitest מתעלם בשקט מקובץ בדיקות שצוין ואינו קיים, כך שאפשר לאבד
 * שכבת כיסוי שלמה במיזוג ולראות "הכל עובר". כאן זה נכשל ברעש.
 */
import { existsSync, readFileSync } from 'node:fs'

const { scripts } = JSON.parse(readFileSync('package.json', 'utf8'))
const listed = [...scripts.test.matchAll(/tests\/[\w.-]+\.jsx?/g)].map((m) => m[0])
const missing = listed.filter((file) => !existsSync(file))

if (missing.length) {
  console.error(`קבצי בדיקות שצוינו ואינם קיימים: ${missing.join(', ')}`)
  process.exit(1)
}
