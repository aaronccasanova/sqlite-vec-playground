/**
pnpm tsx examples/crud/update.ts \
  --id 1 \
  --content "Vending Machines Are Deadlier Than Sharks: Statistically, you're more likely to be killed by a falling vending machine than by a shark attack."
*/
import * as util from 'node:util'
import ollama from 'ollama'
import { db } from '../db'

const args = util.parseArgs({
  options: {
    content: { type: 'string', short: 'c' },
    id: { type: 'string', short: 'i' },
  },
})

const content = args.values.content
const id = args.values.id ? Number(args.values.id) : undefined

if (!content || !id || !Number.isInteger(id)) {
  throw new Error('Expected integer id and content arguments')
}

const updateDoc = db.prepare(/* sql */ `
  update docs set content = @content where id = @id
`)

const updateVecDoc = db.prepare(/* sql */ `
  update vec_docs set doc_embeddings = @doc_embeddings where doc_id = @id
`)

const embedResponse = await ollama.embed({
  model: 'nomic-embed-text',
  input: content,
})

db.transaction(() => {
  updateDoc.run({ id, content })

  updateVecDoc.run({
    id: BigInt(id),
    doc_embeddings: new Float32Array(embedResponse.embeddings[0]),
  })
})()

console.log(`✅ Updated doc ${id}.`)
