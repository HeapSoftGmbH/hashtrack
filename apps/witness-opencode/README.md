# witness-opencode

Persistent agent analytics for [opencode](https://opencode.ai) v2. Records the tokens and dollars spent in every opencode session into the same per-repo log the other witness adapters use: `<git-root>/.witness/usage.jsonl` and `<git-root>/.witness/synced.jsonl`. Shows the running repo total in the TUI and in OpenCode Desktop, and opens the detailed web dashboard on demand.

## Install

Requires opencode 2 — the plugin uses the V2 plugin API (`Plugin.define` + `ctx.event.subscribe`). Add the plugin to `opencode.json`:

```json
{
	"$schema": "https://opencode.ai/config.json",
	"plugins": ["witness-opencode"]
}
```

opencode installs npm plugins with Bun at startup. For local development, point the entry at the package directory instead — configured local paths must be directories, not files:

```json
{ "plugins": ["/absolute/path/to/witness/apps/witness-opencode"] }
```

One entry loads every part: the server, the terminal UI, and the desktop app. The package exports the built files in `dist/`, so a local checkout needs a build first:

```bash
bun run build:opencode   # from the repo root
```

Re-run it after changing anything under `src/`. OpenCode Desktop loads the prebuilt `dist/gui-experimental.cjs`, which the same command produces.

## Repo totals

Both UIs read the same RPC (`./rpc`) and show the current repository's totals next to the prompt, in the same format as the pi extension:

```
⣏ 196M · $18.27
```

The mark is the witness favicon drawn as braille in the favicon orange (`#bb4d00`), since a terminal status line cannot show the SVG. Desktop draws the real favicon next to the text instead.

- **TUI** (`./tui`): the `prompt.footer.status` and `home.footer.status` slots, refreshed every 10 s and on `session.idle` / `session.execution.succeeded`.
- **Desktop** (`./gui-experimental`): the `session.header` slot; clicking the totals opens the dashboard. Re-read when the session's directory changes.
- Totals come from every record in `<git-root>/.witness` (pending `usage.jsonl` plus archived `synced.jsonl`), so they survive uploads.

## Dashboard

Run `/witness` (also in the command palette as **Witness: open dashboard**) to start a local viewer and open it in your browser. The viewer serves the built `packages/local-web` app on `127.0.0.1:4447` (an ephemeral port if 4447 is taken) and exposes `/api/records?dir=<repo>` for the SPA.

The viewer is started by the server part on first use and stopped when the plugin unloads. It needs the dashboard build:

```bash
bun run build:web   # builds packages/local-web into apps/witness-opencode/web
```

## What is recorded

- One record per run (idle-to-idle burst), one turn per finished assistant step
- Only sessions in this plugin instance's location: the event stream is server-wide, events from other locations are ignored
- input / output / cache-read / cache-write / reasoning tokens and cost, from opencode's own per-step accounting
- every completed or failed tool call with its name (from `session.tool.*` events; tool calls carry no separate token cost in opencode)
- model as `provider/model`, opencode version, session title (falling back to the session slug until a title exists)
- skills, from `session.skill.activated`

Records are buffered and appended once when the session goes idle and again when the plugin unloads.

## Build

```bash
bun run build          # everything below, in order
bun run build:server   # bundles the server part to dist/index.js
bun run build:rpc      # bundles the RPC contract to dist/rpc.js
bun run build:tui      # bundles the terminal UI to dist/tui.js
bun run build:web      # builds the dashboard into ./web
bun run build:gui      # bundles the desktop part to dist/gui-experimental.cjs
```

`bun run prepack` runs the full build when the package is published. Only `dist/` and `web/` are shipped; `witness` and `lib` are bundled in, so the published plugin has no workspace dependencies.

> Security: opencode plugins run with your full user permissions. Review the source before installing anything from a third party.
