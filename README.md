# Voyage Research

A research assistant that shows how the retrieval layer for AI applications evolves on **MongoDB Atlas** and **Voyage AI**,
from basic cited answers to hybrid search, native reranking, multi-tenant filtering and measurable optimization.
Five API versions run side by side; the UI progressively reveals each version's controls.

| Directory | What it is |
|---|---|
| [`client/`](client/README.md) | React 19 + TypeScript + Vite + Tailwind v4 frontend. Runs without a backend, with an optional labelled demo mode. |
| [`server/`](server/README.md) | Java 25 / Spring Boot 4 backend: ingestion, `/api/v1`…`/api/v5`, Atlas Vector Search, `$rankFusion`, `$rerank`, evaluation. |

## Run both

```bash
# 1. Backend (needs an Atlas cluster, an OpenAI key, and the two Atlas indexes; see server/README.md)
cd server
cp .env.example .env            # set MONGODB_URI and OPENAI_API_KEY
mongosh "$MONGODB_URI" --file atlas/create-indexes.js
SPRING_PROFILES_ACTIVE=dev mvn spring-boot:run      # http://localhost:8080 (dev profile = seeded local test user)

# 2. Frontend
cd ../client
npm install
npm run dev                                         # http://localhost:5173
```

Pick the API version in the app's Settings page. To explore the UI without any backend, run `VITE_USE_MOCK_API=true npm run dev` in `client/`.

## Tests

```bash
cd client && npm test     # Vitest, no backend
cd server && mvn test     # needs Docker (Testcontainers MongoDB); Atlas-only tests run when ATLAS_TEST_URI is set
```

## Status

Client and server test suites pass. The client was also checked against the running server for workspaces, documents,
upload, conversations and error handling. **The Atlas-specific paths have not been run against a live Atlas cluster**
(automated embedding, `$vectorSearch`, `$search`, `$rankFusion`, `$rerank`, and generated chat answers). They follow the
current MongoDB documentation and are covered by pipeline-shape tests plus an opt-in Atlas suite. See
`server/README.md` for details and limitations.
