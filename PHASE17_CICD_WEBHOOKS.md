# Phase 17: CI/CD Integration and Webhook Triggers

Nexuss-Git now includes a local CI/CD integration service for verified GitHub webhook intake and explicit workflow-trigger requests.

## Webhook intake

The server exposes:

```text
POST /api/webhooks/github
GET  /api/webhooks/github?limit=100
```

Webhook requests must include `X-Hub-Signature-256`, verified with the `GITHUB_WEBHOOK_SECRET` environment variable. The body is verified before JSON parsing. GitHub delivery IDs are retained and duplicate deliveries are acknowledged without creating a second event.

The normalized event contains only bounded operational fields: delivery ID, event name, action, repository name, ref, commit SHA, timestamp, and accepted status. Payload contents and credentials are not stored.

## Workflow triggers

The server exposes:

```text
POST /api/pipeline/trigger
GET  /api/pipeline/triggers?limit=100
```

A trigger request requires `confirmed: true`, a workflow name, a ref, and a reason. Confirmed requests are stored as `requested` pipeline records. This phase intentionally does not silently dispatch a workflow or bypass the explicit confirmation boundary; a future GitHub API dispatcher can consume these records under the same safety journal and authorization model.

## Storage

Events are stored locally in:

```text
.nexuss-git/webhook-events.ndjson
.nexuss-git/pipeline-triggers.ndjson
```

Writes are serialized and reads are bounded to 5,000 records. Newline-bearing values are flattened and all fields are length-limited.

## Configuration

Set the webhook secret before starting the local server:

```bash
GITHUB_WEBHOOK_SECRET=replace-me NEXUSS_REPOSITORY_ROOT=/path/to/repository npm start
```

The webhook endpoint should be exposed through a trusted HTTPS ingress in a deployed environment. The default standalone server remains bound to loopback.
