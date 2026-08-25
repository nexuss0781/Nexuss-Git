# Nexuss-Git

Nexuss-Git is the standalone repository workspace extension for Nexuss-Agent. It provides a typed, user-friendly boundary around local Git operations so callers do not need to assemble command-line invocations or handle mutation safety themselves.

## Phase 14 capabilities

`GitWorkspace` currently supports repository verification, status inspection, branch listing, branch creation, branch switching, selective staging, selective unstaging, staged and unstaged diffs, commits, and guarded pushes.

```ts
import { GitWorkspace } from "./dist/gitWorkspace.js";

const workspace = new GitWorkspace("/workspace/project");
const status = await workspace.status();
await workspace.stage(["src/app.ts"]);
const diff = await workspace.diff(true);
await workspace.commit("Update application flow");
await workspace.push({ branch: "feature/app-flow", confirmed: true });
```

## Workspace controller

`WorkspaceController` is the UI-facing facade over `GitWorkspace`. It returns a structured `{ ok, data }` or `{ ok, code, message }` response for every operation and provides a combined snapshot containing the current branch, file status, branch list, staged diff, and unstaged diff. Mutations are serialized so two UI actions cannot change the same repository concurrently.

```ts
const workspace = new WorkspaceController("/workspace/project");
const snapshot = await workspace.snapshot();
const staged = await workspace.stage(["src/app.ts"]);
```

## Browser workspace

Run the local workspace against a repository with:

```bash
NEXUSS_REPOSITORY_ROOT=/path/to/repository npm start
```

Then open `http://127.0.0.1:4174`. The browser surface uses the controller through a small local JSON API. It shows status metrics, branch selection and creation, staged and unstaged files, diff output, commit composition, and a confirmation dialog before a push.

The server routes are `GET /api/snapshot`, `POST /api/branch/create`, `POST /api/branch/switch`, `POST /api/stage`, `POST /api/unstage`, `POST /api/commit`, and `POST /api/push`. The server binds to loopback by default and does not expose repository operations to the network unless deployment configuration explicitly changes that boundary.

## Safety boundary

The service never invokes a shell. Git is called through `execFile` with an argument array. Repository paths must remain inside the selected repository root. Branch names are validated before use. Commit messages are bounded to 200 characters. Pushes require an explicit confirmation flag, and direct pushes to `main`, `master`, `production`, and `release` are rejected so collaboration can happen through a review workflow.

A failed mutation throws `GitWorkspaceError` with a stable code such as `INVALID_PATH`, `NOT_REPOSITORY`, `INVALID_BRANCH`, `CONFIRMATION_REQUIRED`, `PROTECTED_BRANCH`, or `GIT_FAILED`. Callers can display the error and retry without losing the current workspace state.

## Scope boundary

This repository owns the local Git operation library. Nexuss-Agents remains the host application and Axolotl Store runtime. The host integration and package manifest are intentionally implemented in later release phases, after this standalone API is stable.

## Development

```bash
npm install
npm run check
npm test
```

The test suite creates temporary repositories and covers status parsing, staging, diff statistics, branch creation, commits, path confinement, push confirmation, and protected-branch blocking.
