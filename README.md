# Form Aadhaar Parser — Developer Guide

This repository provides a small, production-minded service and CLI for extracting structured data from scanned forms and Aadhaar cards using AI backends (Google Gemini primary, OpenRouter as an optional fallback).

## High-level architecture

- Preprocessing (OpenCV + PyMuPDF): normalize photos/PDFs, crop the document, remove shadows and contrast noise.
- Parser layer: a pluggable `ParserFactory` builds a parser (the default "auto" parser uses Gemini first and OpenRouter as a fallback).
- Two entry points:
   - API: `api.py` (FastAPI) — accepts file uploads, processes files in a safe temporary workspace, and returns structured JSON.
   - CLI: `main.py` — batch-runs over the `images/` folder and writes per-file JSON to `outputs/`.

## Key files and folders

- `api.py` — FastAPI app. Mounts the `frontend/` directory, exposes `/parse-batch`, and runs a background cleanup task for orphan temp files.
- `main.py` — simple CLI batch runner that mirrors the API preprocessing steps so CLI and API results match.
- `parsers/` — parser implementations and factory:
   - `base.py` — `BaseDocumentParser` abstract interface.
   - `auto.py` — `GeminiAutoParser`, `OpenRouterAutoParser`, and a `FallbackAutoParser` wrapper.
   - `factory.py` — `ParserFactory` registry and cache (register new parser builders here).
   - `preprocessing.py` — image/PDF rasterization and cleanup utilities used by both entry points.
- `frontend/` — optional static single-page UI served at `/` by the API.
- `images/` (runtime) — drop files here for the CLI.
- `outputs/` (runtime) — CLI saves results here.

## Request / processing flow (API)

1. Uploads are streamed to a temporary file (prevents large in-memory buffers).
2. PDFs are rasterized to a temp JPEG so every document path receives the same image pipeline.
3. `crop_to_document()` tries to find and warp the page corners; it preserves the source file if detection is uncertain.
4. `enhance_document_image()` flattens lighting and improves contrast (grayscale pipeline).
5. A process-local `asyncio.Semaphore` (`queue_lock`) serializes parser calls to avoid free-tier rate-limit bursts.
6. `ParserFactory.get_parser("auto")` returns a cached parser instance. The parser does the AI call and returns a structured JSON object.
7. Temporary files are removed in a `finally` block; `api.py` also runs a background sweep to remove orphaned temp files older than one hour.

## Parser behavior and extension points

- The "auto" parser is built in `parsers/factory.py` and uses Gemini (requires `GEMINI_API_KEY`) as the primary model.
- If `OPENROUTER_API_KEY` is present the factory will return a `FallbackAutoParser` that switches to OpenRouter when Gemini is rate-limited.
- To add a new parser type:
   1. Implement `MyParser` subclassing `BaseDocumentParser` and provide a `parse(self, file_path: str) -> dict` method.
   2. Register a builder with `ParserFactory.register("mytype", lambda api_key=None: MyParser(api_key))`.

## Configuration & environment

- Required: `.env` with `GEMINI_API_KEY`.
- Optional: `OPENROUTER_API_KEY` to enable automatic fallback.

Example `.env`:

```
GEMINI_API_KEY=sk-...
OPENROUTER_API_KEY=sk-...  # optional
```

## Running locally

- API (development):

```bash
uvicorn api:app --reload
```

- CLI batch runner:

```bash
python main.py
```

Place input PDFs and images in `images/`. CLI saves results to `outputs/`.

## Concurrency, rate-limits and deployment notes

- The API uses a per-process semaphore to serialize calls to the AI backend. If you run multiple workers (gunicorn/uvicorn --workers > 1) you'll need a centralized rate limiter (Redis, etc.) to avoid exceeding API quotas.
- Temp files are written to the OS temp directory with the prefix defined by `TEMP_FILE_PREFIX` so external cleanup scripts can safely identify app-owned files.

## Developer tips

- Keep `Gemini` and `OpenRouter` SDK versions pinned in `requirements.txt` to avoid breaking changes in exception attributes used for rate-limit detection.
- The preprocessing pipeline currently converts images to grayscale. If you need color-aware extraction (stamps, color-coded fields) update `enhance_document_image()` to operate on LAB channels instead.
- The AI prompt in `parsers/auto.py` (`AUTO_PROMPT`) defines the exact JSON schema the parsers return; changing it requires updating downstream consumers.

## Adding tests

Start by writing unit tests for `parsers/preprocessing.py` functions and a small integration test that runs `main.prepare_for_parsing()` on a sample image. Consider using a fixture directory with small sample images/PDFs.

---

If you'd like, I can also add a short CONTRIBUTING or developer quick-start with exact commands to create a virtualenv and run the API. Ready to add that next? 
