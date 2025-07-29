/**
pnpm tsx examples/basic/ingest.ts
*/
import ollama from 'ollama'
import { db } from '../db'

db.exec(/* sql */ `
  create table if not exists docs(
    id integer primary key autoincrement,
    content text
  )
`)

db.exec(/* sql */ `
  create virtual table if not exists vec_docs using vec0(
    doc_id integer primary key,
    doc_embeddings float[768]
  )
`)

// Since virtual tables in SQLite don't support foreign key constraints,
// we use a trigger to manually enforce referential integrity. This trigger
// mimics the `ON DELETE CASCADE` behavior, automatically deleting a vector
// from `vec_docs` when its corresponding document is deleted from `docs`.
db.exec(/* sql */ `
  create trigger if not exists delete_doc_embeddings
  after delete on docs
  for each row
  begin
    delete from vec_docs where doc_id = OLD.id;
  end;
`)

const insertDoc = db.prepare(/* sql */ `
  insert into docs (content) VALUES (@content)
`)

const insertVecDoc = db.prepare(/* sql */ `
  insert into vec_docs (doc_id, doc_embeddings)
  values (@doc_id, @doc_embeddings)
`)

const contents = getContents()

console.time('ingest')

const embedResponse = await ollama.embed({
  model: 'nomic-embed-text',
  input: contents,
})

db.transaction(() => {
  const docIds = contents.map(
    (content) => insertDoc.run({ content }).lastInsertRowid,
  )

  docIds.forEach((docId, i) => {
    insertVecDoc.run({
      doc_id: BigInt(docId),
      doc_embeddings: new Float32Array(embedResponse.embeddings[i]),
    })
  })
})()

console.timeEnd('ingest')

console.log(`✅ Ingested ${contents.length} docs.`)

function getContents() {
  return [
    'Honey Never Spoils: Archaeologists have found pots of honey in ancient Egyptian tombs that are over 3,000 years old and still perfectly edible.',
    'Bananas Are Berries: Botanically, bananas qualify as berries, but strawberries do not.',
    'Octopuses Have Three Hearts: Two pump blood to the gills, while the third pumps it to the rest of the body.',
    'Venus Spins Backwards: Unlike most planets in our solar system, Venus rotates in the opposite direction, so the Sun rises in the west and sets in the east.',
    'A Group of Flamingos Is Called a “Flamboyance”: The collective noun for flamingos is as colorful as the birds themselves.',
  ]
}
