# Phase 15: Safety Journal and Audit Logging

Nexuss-Git now records a local append-only safety journal at `.nexuss-git/audit.ndjson`. The journal is owned by the standalone repository workspace and is separate from GitHub API activity.

## Event model

Each event records an identifier, UTC timestamp, operation name, outcome, repository root, actor label, and bounded metadata. Outcomes are `started`, `succeeded`, `failed`, and `denied`.

| Event field | Behavior |
|---|---|
| `id` | Unique timestamp/random identifier |
| `at` | ISO-8601 UTC timestamp |
| `operation` | Bounded operation name |
| `outcome` | Start, success, failure, or denial |
| `repository` | Selected local repository root |
| `actor` | Sanitized local actor label |
| `metadata` | Maximum 20 sanitized scalar fields |

Metadata values are limited to short strings, numbers, booleans, or null. Newlines are flattened to prevent log-line injection. Keys containing `token`, `secret`, `password`, `credential`, `authorization`, or `accessKey` patterns are discarded. File contents, commit contents, Git remotes, and credentials are not persisted as event metadata.

## Recorded operations

The controller records operation start and terminal outcome for branch creation, branch switching, staging, unstaging, commits, and pushes. Push confirmation failures and protected-branch blocks are recorded as `denied`. Errors are returned to the caller while the journal preserves the outcome for review.

Writes are serialized through a promise queue, which keeps concurrent event appends ordered and prevents interleaved NDJSON records. Journal reads return the newest bounded records first; the current retention ceiling is 2,000 events.

## API and browser view

The standalone server exposes:

```text
GET /api/audit?limit=50
```

The browser workspace now presents recent operations in a compact Safety Journal panel with outcome-specific colors and refresh behavior.

## Security boundary

The journal is local to the selected repository and is served only through the loopback workspace server by default. It is intended for transparent user review, not as a tamper-proof security ledger. The browser renders event operation and outcome fields only; it does not expose raw metadata by default.
