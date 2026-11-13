# Voyage Research: Research Intelligence Frontend

A React 19 + TypeScript + Vite + Tailwind CSS v4 frontend for a research assistant that grows from basic cited
answers (V1) to a tunable retrieval system (V5) on MongoDB Atlas and Voyage AI. One shared interface progressively
reveals retrieval controls as the API version increases. **The backend does not need to exist**: the app renders,
navigates, and fails gracefully without it.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build
npm run test       # Vitest + React Testing Library (no backend needed)
```

## Environment variables

Copy `.env.example` to `.env`.

| Variable | Default | Purpose |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:8080` | Backend origin. Routes are `{base}/api/v1/...` through `/api/v5/...`. |
| `VITE_USE_MOCK_API` | `false` | `true` serves clearly-labelled demo data and makes no network calls. |
| `VITE_HEALTH_PATH` | *(empty)* | Optional health route (e.g. `/health`). Probed once on load and on Retry. If empty, connection status is derived from real requests. |

## Demo / mock mode

```bash
VITE_USE_MOCK_API=true npm run dev
```

A **Demo Mode** badge appears in the header. The mock transport (`src/mocks/`) is installed explicitly in `main.tsx`
via a dynamic import, so it is not loaded at all when the flag is off. It is **never** enabled as a fallback when
requests fail. It demonstrates every version: one workspace in V1–V3 and several in V4+, `retrieval/options` only from
V4, reranking notes from V3, metadata filtering from V4, and diagnostics in V5 (with `mrr` deliberately omitted to show
"Not available"). Mock state is kept per API version, so nothing created under one version appears under another.

## How API version switching works

- `ApiVersionContext` holds the version (default `v1`, persisted in `localStorage`).
- `src/config/capabilities.ts` is the single source of truth for what each version supports. Components read
  capabilities; there are no scattered `version === "v3"` checks.
- On a switch the app: persists the choice; **aborts every in-flight request** (`invalidateOutstandingRequests`);
  re-fetches workspaces, conversations, documents and retrieval options from the new version's routes (data from the old
  version is cleared immediately and never assumed valid); sanitizes retrieval settings (incompatible values reset to
  defaults, compatible ones kept, e.g. V4→V3 drops filters but keeps strategy and reranking); clears the open citation;
  and resets the chat so a late response from the old version cannot appear.
- `buildChatPayload` (`src/api/requestBuilder.ts`) only emits fields the selected version supports.

## Error handling

All requests go through `src/api/client.ts`, which maps failures to a typed `ApiError`:

| Situation | `ApiErrorType` | Message |
|---|---|---|
| Backend unreachable | `NETWORK_ERROR` | Unable to connect to the research API. Check that the backend is running. |
| 404 | `NOT_FOUND` | This feature is not available in the selected API version yet. |
| 405 | `METHOD_NOT_ALLOWED` | This operation is not supported by the current API. |
| 401 / 403 | `UNAUTHORIZED` / `FORBIDDEN` | Plain access messages; no server details. |
| 5xx | `SERVER_ERROR` | The research service encountered an error. Please try again. |
| Timeout | `TIMEOUT` | The request took too long. Please try again. |
| Bad/unexpected body | `INVALID_RESPONSE` | The API returned an unexpected response. |

User cancellation (Stop button, version switch) is distinct from timeouts and is not reported as an error. Response
bodies are validated with type guards (`src/api/guards.ts`) at the API boundary. Connection status
(Connected / Unavailable / Checking) is derived from real requests: any HTTP response, even a 404, means the server is
up; only network failures and timeouts mark it unavailable. There is no polling; **Retry** re-runs the initial loads once.

## Backend contract

The backend lives in [`../server`](../server/README.md) and this client targets it directly. All routes exist under
`/api/{v1..v5}/`; only the chat request differs between versions. The wire format is declared in one place,
`src/api/guards.ts` (types, guards, and mappers to the UI models), and `src/api/serverContract.test.ts` checks it
against responses captured from the real server.

| Method | Path | Response |
|---|---|---|
| `POST` | `/chat` | `{ conversationId, answer, citations[{documentId, chunkId, title, pageNumber?, passage, score?}], retrieval{...}, diagnostics? }` |
| `GET` / `POST` | `/workspaces` | array of `{ id, name, description?, ownerId, memberIds, createdAt }` |
| `GET` / `POST` | `/documents?workspaceId=` | array of documents (`processingStatus`: `UPLOADING`, `PROCESSING`, `READY`, `FAILED`); `POST` is multipart (`file`, `workspaceId`) → `201` |
| `GET` / `DELETE` | `/documents/:id` | document / `204` (`409` while processing) |
| `GET` | `/conversations`, `/conversations/:id` | summaries / conversation with `messages[{ role: "USER" or "ASSISTANT", ... }]` |
| `GET` | `/retrieval/options` (v4+) | `{ documentTypes, tags }` |
| `GET` | `/retrieval/configurations` (v5) | array of `{ id, label, embeddingModel, quantization, requiresReindex, requiresReembedding, available, unavailableReason }` |

Chat request by version (the server rejects fields a version does not support):

```jsonc
// V1  { "question", "workspaceId" }
// V2  + "retrievalStrategy": "vector" | "text" | "hybrid"
// V3  + "reranking": { "enabled", "candidateCount", "finalResultCount" }
// V4  + "filters": { "publicationYear": { "min", "max" }, "documentTypes": [], "tags": [] }
// V5  + "optimization": { "embeddingConfiguration", "quantization", "diagnosticsEnabled" }
```

`conversationId` is added when continuing a conversation. Diagnostics contain only values the server measured; anything
else (for example reranking latency, Recall@K, MRR) is shown as "Not available". Documents become `READY` only after
Atlas finishes embedding them, which can take a while, so the library has a Refresh button (it never polls).

## Connecting the backend

1. Start the backend (`cd ../server`, see its README) and set `VITE_API_BASE_URL` if it is not on `http://localhost:8080`. The server allows `http://localhost:5173` by default.
2. Leave `VITE_USE_MOCK_API=false` and restart `npm run dev`.
3. Open **Settings → Connection** to see the status and the exact routes expected for the selected version.
   Routes not implemented yet show "not available in the selected API version yet" rather than failing.

## Project layout

```
src/api/         client (fetch, errors, timeouts, cancellation), per-resource modules, guards, request builder
src/config/      capabilities (version → features), version metadata, retrieval defaults/validation
src/context/     ApiVersion, Connection, Workspace, Conversations, Citation
src/hooks/       useChat, useDocuments, useApiResource, useRetrievalConfig, ...
src/components/  layout, chat, documents, citations, retrieval, settings, common
src/mocks/       demo transport + data (separate from production API modules)
```

## Notes

- Persisted in `localStorage`: API version, sidebar state, retrieval preferences. Never documents or credentials.
- PDF preview is not implemented; the citation panel shows the returned passage and metadata, and an informative
  state if full document details can't be loaded.
