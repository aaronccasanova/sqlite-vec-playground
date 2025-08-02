/**
pnpm tsx examples/metadata/ingest.ts
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
    doc_embeddings float[768],
    category text not null
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
  insert into vec_docs (doc_id, doc_embeddings, category)
  values (@doc_id, @doc_embeddings, @category)
`)

const docs = getDocs()

console.time('ingest')

const embedResponse = await ollama.embed({
  model: 'nomic-embed-text',
  input: docs.map((doc) => doc.content),
})

db.transaction(() => {
  const docIds = docs.map(
    (doc) => insertDoc.run({ content: doc.content }).lastInsertRowid,
  )

  docIds.forEach((docId, i) => {
    insertVecDoc.run({
      doc_id: BigInt(docId),
      doc_embeddings: new Float32Array(embedResponse.embeddings[i]),
      category: docs[i].category,
    })
  })
})()

console.timeEnd('ingest')

console.log(`✅ Ingested ${docs.length} docs.`)

function getDocs() {
  return [
    {
      content:
        'Honey Never Spoils: Archaeologists have found pots of honey in ancient Egyptian tombs that are over 3,000 years old and still perfectly edible.',
      category: 'food',
    },
    {
      content:
        'Bananas Are Berries: Botanically, bananas qualify as berries, but strawberries do not.',
      category: 'food',
    },
    {
      content:
        'Octopuses Have Three Hearts: Two pump blood to the gills, while the third pumps it to the rest of the body.',
      category: 'animals',
    },
    {
      content:
        'Venus Spins Backwards: Unlike most planets in our solar system, Venus rotates in the opposite direction, so the Sun rises in the west and sets in the east.',
      category: 'space',
    },
    {
      content:
        'A Group of Flamingos Is Called a "Flamboyance": The collective noun for flamingos is as colorful as the birds themselves.',
      category: 'animals',
    },
    {
      content:
        'The Eiffel Tower Can Be 15 cm Taller During the Summer: When iron heats up, it expands, causing the tower to grow.',
      category: 'science',
    },
    {
      content:
        'A Day on Venus Is Longer Than a Year on Venus: It takes Venus longer to rotate once on its axis than to complete one orbit of the Sun.',
      category: 'space',
    },
    {
      content:
        'Cleopatra Was Not Egyptian: She was of Greek descent, a member of the Ptolemaic dynasty.',
      category: 'history',
    },
    {
      content:
        'Wombat Poop Is Cube-Shaped: This unique shape is thought to prevent it from rolling away and is used to mark their territory.',
      category: 'animals',
    },
    {
      content:
        'The National Animal of Scotland Is the Unicorn: It was chosen for its association with purity, innocence, and power in Celtic mythology.',
      category: 'history',
    },
    {
      content:
        'There Are More Trees on Earth Than Stars in the Milky Way: Scientists estimate there are over 3 trillion trees, while the Milky Way has 100-400 billion stars.',
      category: 'nature',
    },
    {
      content:
        'Humans Share 50% of Their DNA with Bananas: This highlights the common genetic ancestry of all living organisms.',
      category: 'science',
    },
    {
      content:
        "A Shrimp's Heart Is in Its Head: More accurately, its cardiovascular system is located in the cephalothorax.",
      category: 'animals',
    },
    {
      content:
        'It Rains Diamonds on Saturn and Jupiter: Atmospheric data suggests that high pressure and temperature on these planets can turn carbon into diamonds.',
      category: 'space',
    },
    {
      content:
        'The Shortest War in History Lasted 38 Minutes: It was fought between Britain and Zanzibar on August 27, 1896.',
      category: 'history',
    },
    {
      content:
        'A Single Strand of Spaghetti Is Called a "Spaghetto": This is the proper Italian singular form of the word.',
      category: 'food',
    },
    {
      content:
        'The Human Brain Takes in 11 Million Bits of Information Every Second: However, it is consciously aware of only about 40.',
      category: 'science',
    },
    {
      content:
        'There Is a "Forest" of Underwater "Trees" in the Black Sea: These are not actual trees but formations created by methane seeping from the seabed.',
      category: 'nature',
    },
    {
      content:
        "The First Oranges Weren't Orange: The original variety from Southeast Asia was a tangerine-pomelo hybrid, and it was actually green.",
      category: 'food',
    },
    {
      content:
        'A "Jiffy" Is an Actual Unit of Time: It\'s defined as the time it takes for light to travel one centimeter in a vacuum, about 33.35 picoseconds.',
      category: 'science',
    },
  ]
}
