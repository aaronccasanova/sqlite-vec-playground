/**
pnpm tsx examples/complex/query.ts "fun facts about animals"
pnpm tsx examples/complex/query.ts "fun facts about animals" -t animals
pnpm tsx examples/complex/query.ts "fun facts about animals" -t animals -t science
pnpm tsx examples/complex/query.ts "what are some historical facts" -t history
pnpm tsx examples/complex/query.ts "tell me about space" -t space -t science
pnpm tsx examples/complex/query.ts "interesting facts" -t history -t animals
*/
import * as util from 'node:util'
import ollama from 'ollama'
import { db } from '../db'

const args = util.parseArgs({
  allowPositionals: true,
  options: {
    tags: { type: 'string', short: 't', multiple: true },
  },
})

const query = args.positionals.join(' ')
const tags = args.values.tags || []

if (!query) throw new Error('Expected query argument')

const k = 3
const over_sample = k * 10

const queryDocs = db.prepare(/* sql */ `
  with ${
    !tags.length
      ? ''
      : /* sql */ `
        matched_tags as (
          select dtr.doc_id
          from docs_tags_rel dtr
          join tags t on t.id = dtr.tag_id
          where t.name in (${tags.map(() => '?').join(', ')})
          group by dtr.doc_id
          having count(distinct t.name) = @tag_count
        ),
      `
  }
  matched_docs as (
    select doc_id, distance
    from vec_docs
    where doc_embeddings match @query_embeddings
      and k = @over_sample
  )
  select
    docs.content,
    matched_docs.distance
  from matched_docs
  ${
    !tags.length
      ? ''
      : /* sql */ `
        join matched_tags tf on tf.doc_id = matched_docs.doc_id
      `
  }
  join docs on docs.id = matched_docs.doc_id
  order by matched_docs.distance
  limit @k;
`)

const embedResponse = await ollama.embed({
  model: 'nomic-embed-text',
  input: query,
})

const docs = queryDocs.all(tags, {
  query_embeddings: new Float32Array(embedResponse.embeddings[0]),
  over_sample,
  k,
  tag_count: tags.length,
})

console.log(
  `Query: "${query}"${tags.length > 0 ? `\nTags: [${tags.join(', ')}]` : ''}`,
)

console.log('Docs:')
console.log(docs)
