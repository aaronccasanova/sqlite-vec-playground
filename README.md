# sqlite-vec-playground

## Getting Started

Install dependencies:

```bash
pnpm install
```

Pull embeddings model from [Ollama](https://ollama.com):

```bash
ollama pull nomic-embed-text
```

Embed and ingest documents:

```bash
pnpm tsx examples/basic/ingest.ts
```

Run example query:

```bash
pnpm tsx examples/basic/query.ts "Which planet has sunrise in the west?"
```
