# Research Intelligence: Backend

Spring Boot 4 / Java 25 backend for a research assistant on **MongoDB Atlas** and **Voyage AI**. One application serves
five API versions at the same time (`/api/v1` … `/api/v5`), each adding a retrieval capability:

| Version | Retrieval | Adds |
|---|---|---|
| V1 | `$vectorSearch` | Atlas automated embedding, semantic retrieval, cited answers |
| V2 | + `$search`, `$rankFusion` | `vector` / `text` / `hybrid` strategies |
| V3 | + `$rerank` | Native Voyage reranking, candidate/final counts |
| V4 | + metadata filters | Workspace scoping across tenants, year / type / tag filters |
| V5 | + configuration, diagnostics | Server-defined retrieval configurations, measured latencies, offline evaluation (Recall@K, MRR, p95) |

Application data, retrieval and conversation state all live in one MongoDB database. Versions are independent: you can
call any of them at any time (`mvn test` proves it).

## Quick start

Requirements: JDK 25 (the build targets 25; see "Java version"), Maven 3.9+, an Atlas cluster, an OpenAI API key.

```bash
cd server
cp .env.example .env            # fill in MONGODB_URI and OPENAI_API_KEY (the app reads ./.env automatically)
mongosh "$MONGODB_URI" --file atlas/create-indexes.js     # creates both Atlas indexes (see "Atlas setup")
SPRING_PROFILES_ACTIVE=dev mvn spring-boot:run            # http://localhost:8080
```

The `dev` profile authenticates every request as the seeded user `user-001` and seeds `workspace-001` (yours) and
`workspace-002` (someone else's, to demo isolation). Try `test.http`. Run the React app in `../client` (it defaults to
`http://localhost:5173`, which is the allowed CORS origin).

```bash
mvn test        # standard suite: needs Docker for Testcontainers, no cloud services
```

### Java version

`pom.xml` sets `<java.version>25</java.version>`. The code uses nothing newer than Java 21 features, and the suite was
verified here on JDK 24 with `mvn -Djava.version=24 test` because JDK 25 was not installed on the development machine.
With JDK 25 plain `mvn test` / `mvn spring-boot:run` work.

### Dependency versions (verified compatible)

Spring Boot **4.0.9** (Spring AI 2.0.x is built on Boot 4.0), Spring AI **2.0.2**, MongoDB Java driver **5.6.x** (managed by
Boot), Apache PDFBox **3.0.8**, JTokkit **1.1.0**, Testcontainers (managed by Boot).

## Atlas setup

The retrieval features are Atlas-specific. Automated embedding and `$rerank` are **Preview** features whose syntax and
availability can change; this code follows the current MongoDB documentation:
[automated embedding](https://www.mongodb.com/docs/vector-search/crud-embeddings/automated-embedding/),
[`$rerank`](https://www.mongodb.com/docs/vector-search/query/aggregation-stages/rerank/),
[`$rankFusion`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/rankfusion/).

1. **Cluster.** An Atlas cluster with Vector Search and Atlas Search. `$rankFusion` needs MongoDB 8.0+. `$rerank`
   needs a newer server (the docs say 9.0; the quickstart says 8.3 for the non-`rerank-3` models) and is not available on
   self-managed or Atlas Local deployments.
2. **Database/collections.** Created on first write. The indexes below need `document_chunks` to exist
   (`create-indexes.js` creates it). Spring Data creates the ordinary MongoDB indexes at startup.
3. **Automated embedding (V1+).** `atlas/chunk_vector_index.json` is a `vectorSearch` index with an `autoEmbed` field on
   `content` using model **`voyage-4`** (also available: `voyage-4-lite`, `voyage-4-large`). On Atlas, MongoDB hosts the model;
   **no Voyage API key is needed in this application or in the index**. Atlas generates a vector for every chunk when it is
   inserted. The app never calls the Voyage embedding API for documents.
   *Query embeddings:* with `autoEmbed`, `$vectorSearch` takes the question as text (`"query": "<text>"`) and Atlas embeds it
   with the index's model at query time, so the application does not create query vectors either. Documents are embedded
   asynchronously in the background (Atlas stores them in a generated collection); queries are embedded on demand, which
   is why queries consume rate-limited inference requests while ingestion uses a separate path.
   *Doc discrepancy:* the Atlas docs' code sample shows `query` as a plain string while some prose says `query.text`. This code
   uses the string form from the code sample (one line in `AtlasChunkSearch.vectorSearchStage`).
4. **Filter fields.** The vector index declares `ready`, `workspaceId`, `documentId`, `documentType`, `publicationYear` and
   `tags` as `filter` fields, so access control and metadata filters run *inside* `$vectorSearch`. The text index
   (`atlas/chunk_text_index.json`) maps the same fields as `token`/`number`/`boolean` for `compound.filter`.
5. **Reranking (V3+).** Enable **Native Reranking** in Atlas *Project Settings*. The default model is `rerank-2.5`
   (`app.retrieval.rerank-model`); `rerank-3` / `rerank-3-lite` additionally need a dedicated (M10+) cluster on MongoDB 9.0.
   `$rerank` runs after the first stage (Atlas forbids it inside `$rankFusion` inputs).
6. **Limits.** Free/shared tiers have low embedding rate limits (e.g. 3 requests/minute on M0 without a payment method),
   which affects both queries and the readiness probe. Dedicated clusters need storage auto-scaling or embedding pauses
   when the disk fills.
7. **Credentials.** The application user needs `readWrite` on the database and permission to run `$listSearchIndexes`.
   Credentials come only from environment variables or `.env`; nothing is committed.

Missing features fail loudly and are **never** silently replaced with another algorithm: a missing/not-ready index returns
`503 MISSING_INDEX` / `INDEX_NOT_READY` (checked with `$listSearchIndexes`), an unsupported `$rankFusion`/`$rerank` returns
`503 ATLAS_FEATURE_UNAVAILABLE`, a non-Atlas deployment returns `503 ATLAS_SEARCH_UNAVAILABLE`.
`GET /api/v5/retrieval/configurations` reports index availability.

## Configuration

`src/main/resources/application.yml`; override with environment variables.

| Variable | Purpose |
|---|---|
| `MONGODB_URI`, `MONGODB_DATABASE` | Atlas connection (database default `research_intelligence`) |
| `OPENAI_API_KEY`, `OPENAI_CHAT_MODEL` | Spring AI chat model for answers (default `gpt-4o-mini`). Swap providers by changing the Spring AI starter and `spring.ai.*` properties |
| `CORS_ALLOWED_ORIGINS` | Comma-separated browser origins (default `http://localhost:5173`); never `*` in production |
| `JWT_ISSUER_URI` | OIDC issuer for bearer-token validation (production) |
| `SPRING_PROFILES_ACTIVE` | `dev` (seeded user, local only) or `prod` (JSON logs) |
| `FILE_STORAGE_DIR`, `MAX_UPLOAD_SIZE` | Original-file directory (default `./data/uploads`), upload limit (25MB) |

Tunables: `app.ingestion.chunk-size` (500), `chunk-overlap` (75), `readiness-poll-interval` (20s), `readiness-timeout` (15m),
`app.retrieval.default-candidate-count` (30), `default-final-result-count` (5), `rerank-model`, and the
`app.retrieval.configurations` registry.

## Authentication and authorization

* **Production** (`app.security.mode=jwt`, default): OAuth2 resource server; the user id is the token `sub`. Startup fails with
  a clear message if no `JWT_ISSUER_URI` is configured.
* **Development** (`dev` profile): every request is authenticated as `user-001`. Never client-supplied, refuses to start with
  a `prod`/`production` profile, and is off unless explicitly enabled.
* **Authorization is enforced in every version.** The caller must be a workspace member (404 if the workspace does not exist,
  403 if they are not a member). The authorized workspace ids are put **inside** each Atlas stage's filter (`$vectorSearch.filter`,
  `$search` `compound.filter`, in both `$rankFusion` input pipelines), so other tenants' chunks are never retrieved. V4/V5 may
  omit `workspaceId` to search all of the caller's workspaces. Conversations are private to their creator.

## Document ingestion

`POST /api/vN/documents` (multipart: `file`, `workspaceId`, optional `title`, `author`, `publicationYear`, `documentType`, `tags`):

1. Validates type by extension (PDF, `.txt`, `.md`; PDFs must start with `%PDF-`) and size (413 if too large).
2. Stores the original on disk (`FileStorageService`, no binaries in MongoDB; replace this class for GridFS/S3).
3. Returns `201` with `processingStatus: PROCESSING`; extraction runs on a bounded executor (2 threads, queue 50; 503 if full).
4. PDFBox extracts per page; Markdown is split on headings; chunks are ~500 tokens with ~75 overlap, never crossing a page or
   section, with exact source offsets. **Token counts use cl100k_base (JTokkit), an approximation of Voyage's tokenizer.**
5. Chunks are inserted with `ready=false`. Atlas embeds them in the background.

**Readiness.** Atlas has no per-document "embedded" API (the documented internal collection is off-limits to applications).
`ReadinessMonitor` therefore runs an *exact* `$vectorSearch` filtered to the document and marks it `READY` only when it returns
**all** of the document's chunks. Then `ready=true` is set on the chunks, which is what makes them searchable. A document that is
not queryable within `readiness-timeout` becomes `FAILED` with a reason and its chunks are removed; so a document never
looks READY early and never stays PROCESSING forever. State is in MongoDB, so it survives restarts. Limitation: the probe
embeds one short string per check, and verifies up to 10,000 chunks per document.

Extraction failures (corrupt/encrypted/scanned PDFs) end as `FAILED` with a safe reason and no chunks. Deleting a document that
is still processing returns `409`.

## Retrieval details

* **vector**: `$vectorSearch` (semantic: finds passages near the meaning of the question).
* **text**: `$search` with the `text` operator (BM25 on the literal terms). Exact identifiers like `AP1000` match here even when a
  semantic search would rank them poorly.
* **hybrid**: native **`$rankFusion`** over a vector pipeline and a text pipeline (reciprocal rank fusion, equal weights by default).
  Not an application-side merge.
* **rerank** (V3+): `$rerank` after the first stage over `candidateCount` documents; the best `finalResultCount` are kept. With
  reranking disabled the first-stage order is preserved and only the limit applies.
* Reported counts are **actual**: `retrieval.candidateCount` is how many passages Atlas returned, `finalResultCount` how many were
  used, never the requested numbers.
* Answers: Spring AI `ChatClient` with a grounded prompt that numbers the passages `[1]..[N]`. `CitationService` validates every
  marker: invented ones are removed, the rest renumbered by first use, and `citations` lists exactly the cited chunks. If nothing is
  retrieved, a fixed notice is returned without calling the model. If retrieval or the model fails you get an error, never an answer.
  Conversation history is stored but is **not** fed back into the prompt (each question is answered from fresh retrieval).

## API

Shared in v1–v5 (identical contracts): `GET|POST /workspaces`, `GET /workspaces/{id}`, `GET /workspaces/{id}/documents`,
`GET|POST /documents`, `GET|DELETE /documents/{id}`, `GET|POST /conversations`, `GET|DELETE /conversations/{id}`.
Version-specific: `POST /chat` (v1–v5, each with its own request type), v4/v5 `GET /retrieval/options`,
v5 `GET /retrieval/configurations`, v5 `POST|GET /evaluations`, `GET /evaluations/{id}`.

**Chat request fields by version** (unknown fields are rejected with 400, so older versions never silently ignore settings):

| Field | v1 | v2 | v3 | v4 | v5 |
|---|---|---|---|---|---|
| `question`, `conversationId` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `workspaceId` | required | required | required | optional | optional |
| `retrievalStrategy` (`vector`/`text`/`hybrid`, default hybrid) |  | ✓ | ✓ | ✓ | ✓ |
| `reranking` |  |  | ✓ | ✓ | ✓ |
| `filters` |  |  |  | ✓ | ✓ |
| `optimization` (`embeddingConfiguration`, `quantization`, `diagnosticsEnabled`) |  |  |  |  | ✓ |

**Response (all versions):** `{ conversationId, answer, citations[{documentId, chunkId, title, pageNumber, passage, score}],
retrieval{strategy, rerankingEnabled, candidateCount, finalResultCount}, diagnostics }`. `diagnostics` is V5-only and present only
when `diagnosticsEnabled` is true. Absent values are omitted, never zero-filled.

**Diagnostics** (V5) are measured with `System.nanoTime()` at the application: `retrievalLatencyMs` is the whole aggregation round
trip (including `$rerank`, which Atlas runs inside the same command, so `rerankingLatencyMs` is *not separately measurable* and is
omitted), plus `generationLatencyMs`, `totalLatencyMs`, actual counts and the strategy. These are end-to-end timings, not isolated
Atlas execution times. Recall@K and MRR are **never** returned for a chat question, since they require relevance labels.

**Retrieval configurations (V5).** Changing an embedding model or quantization rebuilds an Atlas index, so a configuration is
`{model, quantization, index}` defined server-side in `app.retrieval.configurations`; clients pick an `id` and arbitrary model names are
rejected (400). Only `default` ships. To add one, create another vector index in Atlas (verify its definition against the current
docs), then add a registry entry; the configurations endpoint reports `requiresReindex`, `requiresReembedding` and whether the index
is queryable now.

**Evaluation (V5).** `POST /evaluations` takes labelled cases (`expectedDocumentIds` and/or `expectedChunkIds`) and the retrieval
settings under test; it returns `202` and runs on a dedicated single-thread executor (queue of 10) without blocking chat. K is
`finalResultCount`. Per case: Recall@K (distinct expected items found in the top K; a labelled document counts once however many of its
chunks appear), reciprocal rank, latency. Aggregate: mean Recall@K, MRR, average and nearest-rank p95 latency. Failed cases are
counted separately and excluded from the means (never scored zero). Results are stored in `retrieval_evaluations`.

**Errors** always look like `{timestamp, status, error, message, path[, details]}`: 400 validation / malformed / unsupported field, 401, 403,
404, 409 (duplicate workspace name; deleting a processing document), 413, 503 (Atlas, index, embedding, reranking or LLM unavailable), 500
(generic message; details are only logged).

## Tests

* Standard suite (`mvn test`): unit tests (chunker, PDF/Markdown extraction, citation validation, metrics, pipeline generation) and
  integration tests on a **real MongoDB** (Testcontainers `mongo:8.0`) covering workspaces, authorization, tenant isolation, documents,
  ingestion, conversations, version routing, request contracts, error shapes, CORS and evaluation. Only the Atlas-only search call and
  the paid LLM call are replaced, so the standard suite needs no cloud services. A local MongoDB cannot run Atlas Search, automated
  embedding, `$rankFusion` or `$rerank`, so the *shape* of those pipelines is asserted in `AtlasPipelineTest`.
* Atlas suite: `AtlasIntegrationTest` is skipped unless `ATLAS_TEST_URI` is set. It ingests a document, waits for `READY`, and runs
  vector, text, hybrid, filtered and reranked retrieval plus a cross-tenant check against a real test deployment (its database needs
  the two indexes):
  `ATLAS_TEST_URI=... ATLAS_TEST_DATABASE=research_it mvn test -Dtest=AtlasIntegrationTest`.
  **This suite has not been run** during development (no Atlas deployment was available), so the Atlas pipelines are verified against the
  documentation, not against a live cluster.

## Known limitations

* Atlas-specific behaviour is unverified against a live cluster (above); automated embedding and `$rerank` are Preview features.
* Readiness uses a query probe rather than a status API (above); probes consume embedding quota.
* Embedding model/quantization alternatives require an operator-created index; none ships beyond `default`.
* Scanned PDFs (no text layer) fail extraction; there is no OCR.
* No pagination on list endpoints; no token-level (Voyage) chunk sizing; conversation history is not part of the prompt.
