/**
pnpm tsx examples/crud/read.ts "What food never spoils?"
*/
import ollama from 'ollama'
import { db } from '../db'

const query = process.argv.slice(2).join(' ')

if (!query) throw new Error('Expected query argument')

const queryDocs = db.prepare(/* sql */ `
  with matched_docs as (
    select
      doc_id,
      distance
    from vec_docs
    where doc_embeddings match @query_embeddings
    order by distance
    limit @k
  )
  select
    docs.content,
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
  k: 3,
})

console.log(`Query: "${query}"`)

console.log('Docs:')
console.log(docs)
