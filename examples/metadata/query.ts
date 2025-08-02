/**
pnpm tsx examples/metadata/query.ts "fun facts about animals"
pnpm tsx examples/metadata/query.ts "fun facts about animals" --category "animals"
pnpm tsx examples/metadata/query.ts "fun facts about animals" --category "food"
pnpm tsx examples/metadata/query.ts "what are some historical facts" --category "history"
pnpm tsx examples/metadata/query.ts "tell me about space" --category "space"
*/
import * as util from 'node:util'
import ollama from 'ollama'
import { db } from '../db'

const args = util.parseArgs({
  allowPositionals: true,
  options: {
    category: { type: 'string', short: 'c' },
  },
})

const query = args.positionals.join(' ')
const category = args.values.category

if (!query) throw new Error('Expected query argument')

const queryDocs = db.prepare(/* sql */ `
  with matched_docs as (
    select
      doc_id,
      category,
      distance
    from vec_docs
    where doc_embeddings match @query_embeddings
    ${category ? ` and category = @category` : ''}
    order by distance
    limit @k
  )
  select
    docs.content,
    matched_docs.category,
    matched_docs.distance
  from matched_docs
  left join docs on docs.id = matched_docs.doc_id;
`)

const embedResponse = await ollama.embed({
  model: 'nomic-embed-text',
  input: query,
})

const docs = queryDocs.all({
  query_embeddings: new Float32Array(embedResponse.embeddings[0]),
  category,
  k: 3,
})

console.log(`Query: "${query}"${category ? `\nCategory: "${category}"` : ''}`)

console.log('Docs:')
console.log(docs)
