/**
pnpm tsx examples/crud/delete.ts 1
*/
import { db } from '../db'

const id = process.argv[2] ? Number(process.argv[2]) : undefined

if (!id || !Number.isInteger(id)) {
  throw new Error('Expected integer id argument')
}

const deleteDoc = db.prepare(/* sql */ `
  delete from docs where id = @id
`)

deleteDoc.run({ id })

console.log(`✅ Deleted doc ${id}.`)
