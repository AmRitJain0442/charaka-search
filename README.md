# चरक — Charaka Search

Natural-language retrieval over the Sanskrit *Carakasaṃhitā*. Ask in English, Hindi,
Devanāgarī, or informal Roman spelling and receive the canonical Sanskrit passage.

The canonical corpus is SARIT's TEI/XML edition, distributed under CC BY-SA 3.0.
The interface never asks a model to compose or quote a śloka: AI is limited to query
interpretation, while every displayed character comes from the indexed source edition.

## How retrieval works

1. The build script reads all eight sthānas from SARIT's TEI/XML.
2. Verse halves inside each `<lg>` are reassembled and prose `<p>` passages are retained.
3. Lossless IAST is normalized for matching and transliterated into Devanāgarī for display.
4. Everyday queries are expanded into likely Sanskrit lexical anchors. A curated bilingual
   concept map is always available; Vercel AI Gateway improves long-tail query interpretation.
5. Exact, compound-substring, citation, term-coverage, and fuzzy signals are fused to rank
   canonical passages. Search results are restricted to ślokas in the current product UI.

The generated corpus contains 9,324 addressable passages: 7,770 verse groups and 1,554
numbered prose passages.

## Development

```bash
npm install
npm run corpus:build
npm run dev
```

The application has a deterministic Sanskrit-aware search layer. It can optionally use
Vercel AI Gateway to interpret long-tail natural-language queries. Set
`ENABLE_AI_EXPANSION=true` after enabling AI Gateway billing on the Vercel account, or
provide `AI_GATEWAY_API_KEY`; the canonical retrieval layer remains the same.

## Commands

```bash
npm test             # retrieval and reference regression tests
npm run lint         # ESLint
npm run build        # regenerate the corpus and create a production build
```

## API

`POST /api/search`

```json
{ "query": "health is the foundation of the four goals of life" }
```

The response includes the query plan and ranked canonical records. The UI displays only
the `devanagari` passage and its source reference.

## Data provenance

See [DATA_LICENSE.md](./DATA_LICENSE.md). Corpus-derived files remain CC BY-SA 3.0.
Application source code is MIT licensed.
