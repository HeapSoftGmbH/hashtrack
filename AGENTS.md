# AGENTS.md

Working on **witness** — token & cost tracking for AI coding agents. Read [README.md](README.md) for the product goal.

## Repo layout

Bun workspaces monorepo:

- `packages/witness` — core. `Session` class: appends turn records, loads repo totals from history. **Harness-agnostic — no imports from any agent SDK here.** Owns the shared `Usage`, `Tool`, `AgentTurnRecord` types.
- `apps/witness-pi` — pi extension (`extensions/index.ts`). Maps pi events → `Session`.
- `apps/witness-claude`, `apps/witness-copilot`, `apps/witness-opencode` — placeholders. Goal: same-core adapters for other harnesses.
- `apps/local-web` — local viewer.

Shared types: `packages/witness` defines and re-exports `AgentTurnRecord`, `Tool`, `Usage`, so any app/workspace with the `"witness": "workspace:*"` dependency can `import type { ... } from "witness"` — no local type copies.

## Commands

```bash
bun install
bun test
bun run lint        # biome check .
bun run lint:fix
```

## Data contract (do not break)

`.witness/usage.jsonl` — one `AgentTurnRecord` JSON per agent burst, append-only, shared by all harnesses:

- Short keys (`t`, `sid`, `sn`, `h`, `mod`, `rep`, `ti`, `tools`, `totalUsage`) are **frozen**. New fields may be added; existing keys are never renamed or removed.
- Two files in `.witness/`: `usage.jsonl` is the pending queue (not uploaded yet), `synced.jsonl` is the archive of uploaded records. `readRecords()` returns both, in that order — dashboards and totals never lose history.
- Storage: `<git-root>/.witness/usage.jsonl`. Repo identity = git remote URL (fallback: git root, then cwd).
- Old/unknown lines must keep parsing — `loadHistory` skips malformed lines; keep that behavior.
- Buffer turns in memory, flush once on idle (`agent_settled`-equivalent) and shutdown. One `appendFileSync` per burst — concurrent agent sessions on the same repo stay safe. Trade-off: hard kill loses the unflushed burst. Exception: uploading appends to `synced.jsonl` and then rewrites `usage.jsonl` (tmp + rename), so a session appending in that window can lose a line.

## Adding a harness adapter

1. New `apps/witness-<harness>` package, `"witness": "workspace:*"` dependency. Import shared types from `witness` (re-exported from `packages/types`).
2. On session start: `new Session({ sessionId, harness: "<name>" })`, then `await session.syncPending()` to push records left unsynced. Cloud sync is opt-in via `cloud: { url, token }` — the adapter reads the token (auth flow is the adapter's job), core does the upload.
3. Map the harness's turn-end/usage events to `session.addTurn({ index, tools, totalUsage })` — tool results often carry their own usage; sum assistant + tool usage into `totalUsage`.
4. Flush on idle and shutdown.
5. Keep the adapter thin — all storage logic lives in `packages/witness`. If an adapter needs new core behavior, add it to core so every harness gets it.

## UI conventions (packages/local-web)

- Use shadcn-svelte components whenever possible. Do not build custom components unless explicitly told to.

## Testing (packages/local-web)

- `packages/local-web` uses **vitest** (`bun run test:web` from the repo root, or `bun run --cwd packages/local-web test`), not `bun test` — root `bun test` only runs `packages/witness` and `apps/witness-pi` (bun can't run `.svelte` tests).
- **Never write tests for `src/lib/components/ui`** — vendored shadcn-svelte, not ours. It's excluded in the vitest config (`test.exclude`).
- Tests colocate as `*.test.ts` next to the code. Pure logic = plain vitest; Svelte components = `mount` from `svelte` + jsdom.
- Component tests that assert chart content after mount must wait a tick — charts draw after the stubbed ResizeObserver reports a size.

## Conventions

- TypeScript strict, Biome (tabs, double quotes, sorted imports).
- Don't classify tool names at write time — store raw names, derive at report time (naming conventions differ per harness).
- No new dependencies unless truly needed; core is stdlib-only.
