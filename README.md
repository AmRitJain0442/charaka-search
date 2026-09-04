# Charaka Search

Natural-language retrieval over the Sanskrit *Carakasaṃhitā*. Ask in English, Hindi,
Devanāgarī, or informal Roman spelling and receive the canonical Sanskrit passage.

The canonical corpus is SARIT's TEI/XML edition, distributed under CC BY-SA 3.0.

## Development

```bash
npm install
npm run corpus:build
npm run dev
```

The application has a deterministic Sanskrit-aware search fallback. On Vercel it can
also use the automatically provisioned OIDC token to interpret natural-language queries
through Vercel AI Gateway.
