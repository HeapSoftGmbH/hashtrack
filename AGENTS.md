# AGENTS.md

Working on **hashtrack** — token & cost tracking for AI coding agents. Read [README.md](README.md) for the product goal.

## Repo layout

Bun workspaces monorepo:

- `packages/core` — core. `Session` class: appends turn records, loads repo totals from history. **Harness-agnostic — no imports from any agent SDK here.** Owns the shared `Usage`, `Tool`, `AgentTurnRecord` types.
- `apps/pi` — pi extension (`extensions/index.ts`). Maps pi events → `Session`.
- `apps/opencode` — opencode v2 plugin. `src/index.ts` is the server part (maps opencode events → `Session`, registers the `hashtrack` RPC); `src/tui.tsx` adds the repo total to the terminal footer and a `/hashtrack` command; `src/gui.tsx` does the same for OpenCode Desktop; `src/web.ts` serves the dashboard.
- `apps/claude`, `apps/copilot` — placeholders. Goal: same-core adapters for other harnesses.
- `packages/lib` — formatters and brand constants shared by the adapters.
- `packages/local-web` — local viewer.

Shared types: `packages/core` defines and re-exports `AgentTurnRecord`, `Tool`, `Usage`, so any app/workspace with the `"@hashtrack/core": "workspace:*"` dependency can `import type { ... } from "@hashtrack/core"` — no local type copies.

## Commands

```bash
bun install
bun run test:extensions   # packages/core + both adapters
bun run test:web          # packages/local-web (vitest)
bun run lint        # biome check .
bun run lint:fix
```

## Data contract (do not break)

`.hashtrack/usage.jsonl` — one `AgentTurnRecord` JSON per agent burst, append-only, shared by all harnesses:

- Short keys (`t`, `sid`, `sn`, `h`, `mod`, `rep`, `ti`, `tools`, `totalUsage`) are **frozen**. New fields may be added; existing keys are never renamed or removed.
- Two files in `.hashtrack/`: `usage.jsonl` is the pending queue (not uploaded yet), `synced.jsonl` is the archive of uploaded records. `Session.readRecords()` (and the read-only `readRepoRecords(cwd)` helper) returns both, in that order — dashboards and totals never lose history.
- Storage: `<git-root>/.hashtrack/usage.jsonl`. Repo identity = git remote URL (fallback: git root, then cwd).
- Old/unknown lines must keep parsing — `loadHistory` skips malformed lines; keep that behavior.
- Buffer turns in memory, flush once on idle (`agent_settled`-equivalent) and shutdown. One `appendFileSync` per burst — concurrent agent sessions on the same repo stay safe. Trade-off: hard kill loses the unflushed burst. Exception: uploading appends to `synced.jsonl` and then rewrites `usage.jsonl` (tmp + rename), so a session appending in that window can lose a line.

## Adding a harness adapter

1. New `apps/<harness>` package, `"@hashtrack/core": "workspace:*"` dependency, npm name `@hashtrack/<harness>`. Import shared types from `@hashtrack/core` (owned by `packages/core`).
2. On session start: `new Session({ sessionId, harness: "<name>" })`, then `await session.syncPending()` to push records left unsynced. Pass `cwd` when the harness runs in a directory other than the process cwd (e.g. a server hosting several projects). If the harness hosts several locations in one process, resolve the directory per event (events carry their own location) and ignore events for locations another adapter instance owns. Cloud sync is opt-in via `cloud: { url, token }` — the adapter reads the token (auth flow is the adapter's job), core does the upload.
3. Map the harness's turn-end/usage events to `session.addTurn({ index, tools, totalUsage })` — tool results often carry their own usage; sum assistant + tool usage into `totalUsage`.
4. Flush on idle and shutdown.
5. Keep the adapter thin — all storage logic lives in `packages/core`. If an adapter needs new core behavior, add it to core so every harness gets it.

## UI conventions (packages/local-web)

- Use shadcn-svelte components whenever possible. Do not build custom components unless explicitly told to.

## Testing (packages/local-web)

- `packages/local-web` uses **vitest** (`bun run test:web` from the repo root, or `bun run --cwd packages/local-web test`), not `bun test` — bun can't run `.svelte` tests.
- **Never write tests for `src/lib/components/ui`** — vendored shadcn-svelte, not ours. It's excluded in the vitest config (`test.exclude`).
- Do not run bare `bun test`: it scans the whole repo and therefore also collects the vitest suites under `packages/local-web`, which fail under bun. `bun run test:extensions` runs `packages/core`, `packages/lib` and both adapters.
- Tests colocate as `*.test.ts` next to the code. Pure logic = plain vitest; Svelte components = `mount` from `svelte` + jsdom.
- Component tests that assert chart content after mount must wait a tick — charts draw after the stubbed ResizeObserver reports a size.

## Conventions

- TypeScript strict, Biome (tabs, double quotes, sorted imports).
- Don't classify tool names at write time — store raw names, derive at report time (naming conventions differ per harness).
- No new dependencies unless truly needed; core is stdlib-only.
