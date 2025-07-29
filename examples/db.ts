import * as path from 'node:path'

import Database from 'better-sqlite3'
import * as sqliteVec from 'sqlite-vec'

export const db = new Database(
  path.join(import.meta.dirname, '../playground.db'),
)

sqliteVec.load(db)

db.pragma('journal_mode = WAL')
