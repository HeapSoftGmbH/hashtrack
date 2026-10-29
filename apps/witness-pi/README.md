# witness-pi

Persistent agent Analytics. Cost & usage tracking for your pi agent. Including models, provider, tokens, cost, skills, tools.

witness-pi is an extension that records the tokens and dollars spent in every pi session and keeps a running total for each repository. You can check your spend at any time, see which models, tools and skills use the most, and find the sessions that cost the most.

[![npm version](https://img.shields.io/npm/v/witness-pi?label=npm)](https://www.npmjs.com/package/witness-pi) [![source](https://img.shields.io/badge/source-GitHub-blue)](https://github.com/HeapSoftGmbH/witness)

## Why use it

- **Cost overview.** The running cost for the repo is always visible in pi's status bar.
- **Totals per project.** Spend is added up per repository, across every session and restart, so you can see what a project has cost so far.
- **See where tokens go.** Find the models, tools and skills that use the most tokens and cost the most.
- **Nothing to set up.** Install it once and keep working. The extension records usage on its own.

## Features

### Live cost in the status bar

```text
⣏ 45.6K · $1.23
```

Shows the total dollars and tokens for the current repository across all sessions. It updates after every agent turn.

### Usage dashboard

Run this inside pi:

```text
/witness-pi:show
```

This opens a local dashboard at `http://localhost:4444`. On macOS it opens in your browser automatically; on other systems pi shows the link. The dashboard shows:

- **Totals:** cost, tokens, and the number of distinct tools and skills used in this repo
- **Model costs:** dollars spent per model per day
- **Tokens used:** tokens per model per day
- **Top models, tools and skills:** how often each one was used
- **Sessions table:** every session with its time, model, turns, tools, skills, tokens and cost. You can sort by any column.

### Detailed tracking

For every agent turn, witness-pi records:

- input, output, cache-read, cache-write and reasoning tokens
- cost in dollars
- each tool call, whether it failed, and the tokens and cost of the tool itself
- the model used (`provider/model`)
- skills used, whether run with `/skill:<name>` or loaded by the agent reading a `SKILL.md`

## Install

```bash
pi install npm:witness-pi
```

To try it for one session without installing:

```bash
pi -e npm:witness-pi
```

Or install the same extension from source:

```bash
pi install git:github.com/HeapSoftGmbH/witness
```

> [!IMPORTANT]
> Pi extensions run with your full user permissions. Review the source before installing anything from a third party.

## Usage

1. Work in pi as usual. Usage is recorded automatically.
2. Check the status bar for the running total.
3. Run `/witness-pi:show` to open the dashboard.
4. Add `/.witness` to your `.gitignore`, unless you want to commit the usage log so your team can share it.
