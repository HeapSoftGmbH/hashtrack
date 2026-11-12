# @hashtrack/claude

Cost & usage tracking for [Claude Code](https://code.claude.com). Records the tokens and dollars spent in every session and keeps a running total for each repository, in the same `.hashtrack/usage.jsonl` that the pi and OpenCode adapters write.

## Install

At the prompt of a Claude Code session:

```
/plugin install hashtrack --marketplace HeapSoftGmbH/hashtrack
```

Answer `y` to add the marketplace, then pick a scope. Or from a shell:

```bash
claude plugin marketplace add HeapSoftGmbH/hashtrack
```

```bash
claude plugin install hashtrack@hashtrack
```

Requires Node.js 18 or newer on `PATH`: the hooks run `node`. Without it nothing is recorded, and the footer says `Hashtrack needs Node.js`; its pane says what was found and where to get Node.js. The check runs when a session starts and again whenever the pane opens, so installing Node.js mid-session clears it.

For local development, build once and load the directory:

```bash
bun run build:claude
```

```bash
claude --plugin-dir apps/claude
```

## In the prompt footer

The plugin replaces the mode labels at the right of the prompt footer with the repo total (`⣏ 3.3M · $2.44`). Click it, or run `/hashtrack`, to open a details pane: this session's tokens, cost and turns, the most expensive models and the most used tools in the repo.

The footer is a native button in the terminal and in the Claude desktop app; a button holds only text, so the mark takes the button's color. The totals refresh when a session starts, after every turn, and whenever the pane opens.

This part is a Claude Code mod: a hooks module (`hooks/register.tsx`, named under `modules` in `hooks/hooks.json`) that runs inside Claude Code's own UI engine, without Node. It reads the numbers by running `node dist/hook.js totals <session-id>`, which prints the repo summary as JSON (`src/summary.ts`). The mod API is early access and may change between releases.

## What it records

One `AgentTurnRecord` per prompt (agent burst), with harness `claude`:

- **Turns**: one per assistant message. Claude Code writes one transcript line per content block, all sharing `message.id` and usage, so the plugin counts each message once.
- **Tokens**: input, output, cache write, cache read, and thinking tokens (`reason`).
- **Cost**: Claude Code transcripts carry no cost, so `src/pricing.ts` prices each message from Anthropic API rates. 1-hour cache writes are billed at 2× input, 5-minute writes at 1.25×, and fast mode at 2×. Unknown models cost 0. On a subscription plan this is the API-equivalent cost, not what you pay.
- **Tools**: raw tool names and whether each result was an error.
- **Skills**: `Skill` tool calls and `/command` prompts.
- **Subagents**: each subagent run gets its own record, with `metadata.agent_type` and `metadata.agent_id`.
- **Session name**: the title set with `/rename`.

When a session starts, a one-line repo total is shown (`⣏ Hashtrack · 3.3M tokens · $2.44 in this repo`).

## How it works

| Hook | Action |
| :- | :- |
| `SessionStart` | Show the repo total; upload pending records when cloud sync is on |
| `Stop` | Record the burst that just finished |
| `SubagentStop` | Record the subagent's transcript |
| `SessionEnd` | Record anything Stop missed (an interrupted burst) |

Each hook is a separate process, so the plugin cannot buffer in memory like the pi adapter. Instead, it reads the transcript and keeps a per-session cursor (the last recorded line) in `$CLAUDE_PLUGIN_DATA/cursors/`. Stop and SessionEnd can run at the same time, so they claim a burst under a lock next to the cursor: neither records what the other already did, and one that Stop missed is picked up by the next Stop or by SessionEnd. A subagent's transcript has no cursor; SubagentStop, which fires once per subagent, records its last burst. Cursors untouched for 30 days are removed.

Hooks only write locally. If cloud sync is configured, they start a detached `node dist/hook.js sync` process that uploads pending records. A slow network never delays your prompt, and the upload still finishes after `claude -p` exits.

## Cloud sync

Opt in by creating `~/.claude/hashtrack/config.json` (respects `CLAUDE_CONFIG_DIR`):

```json
{ "token": "..." }
```

Same shape and behavior as the [pi adapter](../../README.md#cloud-sync). The file is tightened to `chmod 600` on first read.

## Development

```bash
bun test apps/claude/src
```

```bash
claude plugin test apps/claude
```

The recorder's tests are Bun `*.spec.ts` files in `src/`; `claude plugin test` runs every `*.test.ts(x)` in the plugin, so only the UI module's tests (`hooks/register.test.tsx`) use that suffix. Type-check the UI module with `tsc -p apps/claude/hooks` once the plugin has loaded (the engine writes its declarations to `.claude-plugin/types/`).

Notes from the desktop app:

- The footer clips what does not fit with `…`; keep the label short.
- It draws no `Svg` and no `Client` in the footer yet.

## License

[Apache-2.0](LICENSE)
