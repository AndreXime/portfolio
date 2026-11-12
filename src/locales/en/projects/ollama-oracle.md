---
order: 3
experimental: true
title: "Corporate chat with local RAG: sourced answers without inventing policy"
shortDescription: "Lab for a corporate chatbot with local RAG to query policies, courses, and onboarding without sending the corpus to external APIs. Stack on Bun, Hono, React, Ollama, and ChromaDB, with embeddings and generation kept in the local environment. Retrieval filters by distance, reorders by lexical overlap, and falls back to lexical search when vector similarity is weak. The answer streams as NDJSON, with cancellation and per-chunk sources."
tech: ["Bun", "Hono", "React", "Ollama", "ChromaDB", "LangChain"]
imageUrl: "../../../assets/projects/ollama-oracle.png"
github: "https://github.com/AndreXime/ollama-oracle"
---

## Technical context

I modeled a Bun monorepo with workspaces: a Hono API in TypeScript and a React UI (Vite) served by the same process in production. Ollama and ChromaDB run in Docker Compose to keep embeddings and generation local, aligned with not exposing the corporate corpus to external providers. Startup is ordered: Ollama pulls the models on first start, a one-shot ingestion recreates the collection, and only then the app comes up. Inside the app, connections to dependencies are retried in a loop until they respond. Liveness is trivial, and readiness confirms the models on Ollama and the collection on Chroma.

The chat model is small (qwen2.5:3b, with a 4096-token context), and that drove the decisions: few chunks in the prompt and an explicit refusal when the corpus does not cover the question.

## Engineering challenges (how and why)

- **Retrieval with distance gates:** I retrieve far more candidates than fit in the prompt, drop those past the accepted max distance, and require the best one to be good enough. What remains is deduplicated by content, reordered by term overlap with the question, and cut to a few chunks so it fits the model context.
- **Lexical fallback when the vector fails:** if the best embedding is too weak, I look among the same candidates for chunks that share at least two terms from the question and prune those whose overlap is much weaker than the best. Questions with institutional vocabulary, such as the company name, still recover useful chunks without permanently loosening the vector filter for every query.
- **Turn modes and anti-hallucination:** each turn lands in RAG, lexical fallback, conversation, or limitation. Greetings and thanks go through a conversational prompt, without sources. A business question without a good chunk gets a fixed message asking for reformulation, instead of letting the model invent policy.
- **Stream with cancellation:** the API responds in NDJSON with ping, deltas, and a final event with sources. When the client disconnects, I abort generation on Ollama without emitting an error. The UI cancels the previous request when sending another question and on unmount, and ignores sends while a response is in flight.
- **Ingestion typed by format:** Markdown and plain text become one part, CSV becomes one part per record, and JSON extracts subdocuments by shape (string, list of strings, `content`, or `documents`). Each part is split into 900-character chunks with 120 overlap, and reading has a per-file size cap so memory does not blow up. Metadata becomes references like `file.md#p0-c12` in the chat sources.
- **Observability and endpoint protection:** I write one JSONL per day, with one record per turn: question, answer, mode, distances, sources, and whether it aborted. That lets me tune thresholds with data instead of guessing quality from the UI. The endpoint has per-IP rate limiting, Zod body validation, and a payload cap.

## Known limit

The API accepts up to 20 history turns, but history is off by default, and search uses only the current question so it does not pollute the embedding on a small model. Short follow-ups like "and for contractors?" do not inherit context, and the chat asks the user to resend the full question.
