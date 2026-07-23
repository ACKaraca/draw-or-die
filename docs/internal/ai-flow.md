# Draw or Die AI Analysis Flow

## Overview

This document outlines the end-to-end lifecycle of an AI analysis request in the Draw or Die platform. The process starts with user upload and preprocessing, goes through hash caching and memory context merging, builds the prompt for the AI model, and finishes with result persistence and gamification/memory updates.

## 1. Upload & Preprocessing
- Users upload files (images, PDFs) via the frontend components.
- The `useDropHandler.ts` processes files, extracts basic metadata, and handles base64 encoding or form-data conversion.
- The request hits `/api/ai-generate` with the user's files and form metadata (subject, concept, category).

## 2. Hash Cache Behavior (`analysis_file_cache`)
- **Deduplication:** The server computes a unique `file_hash` (often derived from base64 content and mimeType).
- **Cache Lookup:** It checks the `analysis_file_cache` table using `Query.equal('file_hash', hashes)` to see if the file has been processed before.
- **Optimization:** If a file is known, the system reuses its extracted summary/context instead of forcing the AI to re-analyze the raw image from scratch, saving time and tokens.
- **Cache Write:** After a new file is analyzed, its summary and hash are written back to the cache table for future use.

## 3. Memory Snippet Lifecycle (`memory_snippets`)
- **Purpose:** To provide the AI with historical context about the user's architectural style, common mistakes, or recurring feedback.
- **Load:** When a request begins, `loadMemorySnippetsForPrompt(user.id)` fetches the user's past snippets from the database.
- **Inject:** These snippets are formatted into a `memorySnippetsPromptBlock` and appended to the AI prompt (e.g., `\n\nAI HAFIZA NOTLARI:\n...`).
- **Update:** After the AI returns its critique, if it identifies new, persistent traits or corrections, new memory snippets are upserted back into the database to enrich future analyses.

## 4. Prompt Composition
- The system assembles a complex prompt incorporating:
  - **User Input:** Subject, concept, category from the upload form.
  - **Jury Persona:** The selected persona's specific instructions and tone (e.g., Constructive, Grumpy).
  - **Mode Specifics:** Instructions based on the analysis mode (e.g., `SINGLE_JURY`, `MULTI_JURY`, `PREMIUM_RESCUE`).
  - **File Context:** Either the raw files or the cached summaries (`knownFileContextPromptBlock`).
  - **Memory:** The `memorySnippetsPromptBlock`.
- The prompt is routed through the proxy to the underlying LLM (e.g., Gemini).

## 5. Result & Persistence
- The AI returns a structured JSON critique.
- The server parses and validates this response.
- **Persistence:** The result is saved to the `analysis_history` table.
- **Gamification/Economy:** Rapido balance is deducted, and relevant stats (like progression score, Wall of Death count) are updated.
- The JSON is returned to the frontend for display in the Result steps, where the user can read the feedback and optionally start a defense chat.
