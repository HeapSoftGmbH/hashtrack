# Hashtrack cloud API contract

The hashtrack extensions talk to one HTTP API. `POST /api/ingest` uploads records;
`GET /api/records` reads them back for the dashboard. Both use the same personal
API token, so the dashboard shows the server's copy of a repository instead of
the local `.hashtrack` log whenever a token is configured.

Base URL is `https://www.hashtrack.ai` unless the adapter config sets
`url` (`~/.pi/hashtrack/config.json` or `~/.config/opencode/hashtrack/config.json`).

Use the `www` host in `url` too. The apex `https://hashtrack.ai` answers with a
cross-origin `308` to `www.hashtrack.ai`, and `fetch` drops the `Authorization`
header on cross-origin redirects, so the request reaches the API unauthenticated
(`401`) and the record stays pending forever.

## Authentication

Every request carries the token as a Bearer token:

```http
Authorization: Bearer wit_<token>
```

- Missing or invalid token → `401`.
- A token belongs to one user; both endpoints only ever read or write that
  user's records.

## `GET /api/records`

Returns the records of one repository, oldest first, for the dashboard.

```http
GET /api/records?rep=<repository>&since=<timestamp>&until=<timestamp>
Authorization: Bearer wit_<token>
```

### Query parameters

| Name    | Required | Type            | Description                                                                 |
| ------- | -------- | --------------- | --------------------------------------------------------------------------- |
| `rep`   | yes      | string          | Repository identity, exactly as stored in a record's `rep` field.           |
| `since` | no       | ISO-8601 string | Inclusive lower bound on the record time (`t` / `recorded_at`).             |
| `until` | no       | ISO-8601 string | Inclusive upper bound on the record time (`t` / `recorded_at`).             |

`rep` is the git remote URL when the repository has one, otherwise the absolute
git root (and the working directory when it is not a git repository). The client
gets it from the same code that writes `AgentTurnRecord.rep`, so the value round-trips.

All parameters are URL-encoded. `since` and `until` are only filters; omitting
both returns the full history for that repository.

### Response

`200 OK`, `application/json`:

```json
{
	"records": [
		{
			"t": "2026-10-30T09:42:11.123Z",
			"sid": "ses_123",
			"sn": "Fix the dashboard",
			"h": "opencode",
			"hv": "2.2.1",
			"mod": "anthropic/claude-sonnet-4",
			"rep": "https://github.com/example/app",
			"branch": "main",
			"user": { "name": "Ada", "email": "ada@example.com" },
			"turns": [
				{
					"ti": 0,
					"tools": [{ "name": "read", "isError": false }],
					"totalUsage": {
						"in": 1200,
						"out": 300,
						"cw": 0,
						"cr": 800,
						"tok": 2300,
						"reason": 0,
						"cst": 0.012
					}
				}
			],
			"skills": ["frontend-design"],
			"metadata": {}
		}
	]
}
```

- `records` is always present and may be empty.
- Records are ordered by `t` ascending. A record's `sid` plus `t` is unique per
  user; uploads of the same record are idempotent.
- Unknown record fields are preserved and returned as uploaded, so newer
  extensions can add fields without breaking an older server (and vice versa).
- Response size is not capped by the contract; servers must page internally
  rather than truncate a repository's history.

### Errors

| Status | Body                              | When                                                    |
| ------ | --------------------------------- | ------------------------------------------------------- |
| `400`  | `{ "error": "Bad request" }`      | Missing/empty `rep`, or an invalid `since` / `until`.    |
| `401`  | `{ "error": "Unauthorized" }`     | Missing, malformed, or revoked token.                    |
| `500`  | `{ "error": "Internal error" }`   | Server/storage failure. The client keeps local data.     |

Any non-2xx answer is treated as "cloud unavailable": the local viewer serves
`.hashtrack` instead, so a network outage never hides usage data.

## `POST /api/ingest`

Uploads up to 500 records. Used on flush and on startup for pending records.

```http
POST /api/ingest
Authorization: Bearer wit_<token>
Content-Type: application/json
```

```json
{ "records": [] }
```

`200 OK`, `application/json`:

```json
{ "inserted": 3 }
```

`inserted` counts newly written records; re-sending a known record is a no-op,
not an error. `400` means the body failed validation, `401` an invalid token,
`500` a storage failure. A failed upload leaves the record in
`.hashtrack/usage.jsonl` for the next startup.

## `AgentTurnRecord`

The record shape is defined by `AgentTurnRecord` in `packages/core/index.ts`
and validated on upload by the server. The short keys are frozen:

| Key                | Type       | Meaning                                                        |
| ------------------ | ---------- | -------------------------------------------------------------- |
| `t`                | ISO string | Time the agent run started.                                    |
| `sid`              | string     | Harness session id.                                            |
| `sn`               | string     | Session title (may be empty).                                  |
| `h`                | string     | Harness name (`pi`, `opencode`, …).                            |
| `hv`               | string?    | Harness version.                                               |
| `mod`              | string     | Model as `provider/model`.                                     |
| `rep`              | string     | Repository identity (see `rep` above).                         |
| `branch`           | string?    | Git branch at session start.                                   |
| `user`             | object?    | Git `name` / `email` at session start.                         |
| `turns`            | array      | One entry per finished assistant step.                         |
| `turns[].ti`       | number     | Turn index.                                                    |
| `turns[].tools`    | array      | `{ name, isError?, usage? }` per tool call.                    |
| `turns[].totalUsage` | object   | `{ in, out, cw, cr, tok, reason, cst }` summed for the turn.   |
| `skills`           | string[]?  | Skills used in the session.                                    |
| `metadata`         | object?    | Harness-specific data.                                         |

New optional fields may be added; existing keys are never renamed or removed.
Old or unknown fields must keep parsing.

## Client behavior

When a token is configured, the local viewer's `/api/records` endpoint calls
`GET /api/records` and serves that response. It falls back to the local
`.hashtrack` files only when the request fails. The local response carries
`X-Hashtrack-Source: cloud|local` for debugging. Without a token, nothing changes:
the viewer reads local records only.
