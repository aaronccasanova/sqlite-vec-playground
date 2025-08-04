/**
pnpm tsx examples/complex/ingest.ts
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

db.exec(/* sql */ `
  create table if not exists tags(
    id integer primary key autoincrement,
    name text unique not null
  )
`)

db.exec(/* sql */ `
  create table if not exists docs_tags_rel(
    doc_id integer not null,
    tag_id integer not null,
    primary key (doc_id, tag_id),
    foreign key (doc_id) references docs(id) on delete cascade,
    foreign key (tag_id) references tags(id) on delete cascade
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

const upsertTag = db.prepare(/* sql */ `
  INSERT INTO tags (name)
  VALUES (@name)
  ON CONFLICT(name) DO UPDATE SET name = excluded.name
  RETURNING id;
`)

const insertDocTagRel = db.prepare(/* sql */ `
  insert into docs_tags_rel (doc_id, tag_id)
  values (@doc_id, @tag_id)
  on conflict(doc_id, tag_id) do nothing
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
    })

    docs[i].tags.forEach((tag) => {
      const { id: tagId } = upsertTag.get({ name: tag })

      insertDocTagRel.run({
        doc_id: docId,
        tag_id: tagId,
      })
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
      tags: ['food', 'history'],
    },
    {
      content:
        'Bananas Are Berries: Botanically, bananas qualify as berries, but strawberries do not.',
      tags: ['food'],
    },
    {
      content:
        'Octopuses Have Three Hearts: Two pump blood to the gills, while the third pumps it to the rest of the body.',
      tags: ['animals', 'science'],
    },
    {
      content:
        'Venus Spins Backwards: Unlike most planets in our solar system, Venus rotates in the opposite direction, so the Sun rises in the west and sets in the east.',
      tags: ['space', 'science'],
    },
    {
      content:
        'A Group of Flamingos Is Called a "Flamboyance": The collective noun for flamingos is as colorful as the birds themselves.',
      tags: ['animals'],
    },
    {
      content:
        'The Eiffel Tower Can Be 15 cm Taller During the Summer: When iron heats up, it expands, causing the tower to grow.',
      tags: ['science'],
    },
    {
      content:
        'A Day on Venus Is Longer Than a Year on Venus: It takes Venus longer to rotate once on its axis than to complete one orbit of the Sun.',
      tags: ['space'],
    },
    {
      content:
        'Cleopatra Was Not Egyptian: She was of Greek descent, a member of the Ptolemaic dynasty.',
      tags: ['history'],
    },
    {
      content:
        'Wombat Poop Is Cube-Shaped: This unique shape is thought to prevent it from rolling away and is used to mark their territory.',
      tags: ['animals'],
    },
    {
      content:
        'The National Animal of Scotland Is the Unicorn: It was chosen for its association with purity, innocence, and power in Celtic mythology.',
      tags: ['history', 'animals'],
    },
    {
      content:
        'There Are More Trees on Earth Than Stars in the Milky Way: Scientists estimate there are over 3 trillion trees, while the Milky Way has 100-400 billion stars.',
      tags: ['nature', 'science'],
    },
    {
      content:
        'Humans Share 50% of Their DNA with Bananas: This highlights the common genetic ancestry of all living organisms.',
      tags: ['science', 'food'],
    },
    {
      content:
        "A Shrimp's Heart Is in Its Head: More accurately, its cardiovascular system is located in the cephalothorax.",
      tags: ['animals'],
    },
    {
      content:
        'It Rains Diamonds on Saturn and Jupiter: Atmospheric data suggests that high pressure and temperature on these planets can turn carbon into diamonds.',
      tags: ['space'],
    },
    {
      content:
        'The Shortest War in History Lasted 38 Minutes: It was fought between Britain and Zanzibar on August 27, 1896.',
      tags: ['history'],
    },
    {
      content:
        'A Single Strand of Spaghetti Is Called a "Spaghetto": This is the proper Italian singular form of the word.',
      tags: ['food'],
    },
    {
      content:
        'The Human Brain Takes in 11 Million Bits of Information Every Second: However, it is consciously aware of only about 40.',
      tags: ['science'],
    },
    {
      content:
        'There Is a "Forest" of Underwater "Trees" in the Black Sea: These are not actual trees but formations created by methane seeping from the seabed.',
      tags: ['nature'],
    },
    {
      content:
        "The First Oranges Weren't Orange: The original variety from Southeast Asia was a tangerine-pomelo hybrid, and it was actually green.",
      tags: ['food'],
    },
    {
      content:
        'A "Jiffy" Is an Actual Unit of Time: It\'s defined as the time it takes for light to travel one centimeter in a vacuum, about 33.35 picoseconds.',
      tags: ['science'],
    },
  ]
}
