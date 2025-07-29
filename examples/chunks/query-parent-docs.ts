/**
pnpm tsx examples/chunks/query-parent-docs.js "Explain the route module."
*/
import ollama from 'ollama'
import { db } from '../db'

const query = process.argv.slice(2).join(' ')

if (!query) throw new Error('Expected query argument')

const searchParentDocs = db.prepare(/* sql */ `
  with matched_chunks as (
    select
      chunk_id,
      distance
    from vec_chunks
    where vec_chunks.chunk_embeddings match @query_embeddings
    order by distance
    limit 10 -- get more chunks to increase chance of finding unique parent docs
  ),
  distinct_docs as (
    select
      chunks.doc_id,
      min(matched_chunks.distance) as min_distance
    from matched_chunks
    left join chunks on chunks.id = matched_chunks.chunk_id
    group by chunks.doc_id
    order by min_distance
    limit @k
  )
  select
    docs.id,
    docs.content,
    distinct_docs.min_distance as distance
  from distinct_docs
  left join docs on docs.id = distinct_docs.doc_id
  order by distinct_docs.min_distance;
`)

const embedResponse = await ollama.embed({
  model: 'nomic-embed-text',
  input: query,
})

const parentDocs = searchParentDocs.all({
  query_embeddings: new Float32Array(embedResponse.embeddings[0]),
  k: 3,
})

console.log(`Query: "${query}"`)

console.log('Parent Docs:')
console.log(parentDocs)
