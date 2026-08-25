# Phase 14 Continued: Local Workspace Interface

The standalone Nexuss-Git repository now has two layers. `GitWorkspace` owns the safe Git process boundary, while `WorkspaceController` is the UI-facing facade.

## Controller contract

`WorkspaceController.snapshot()` returns the current branch, all local file states, local branches, staged diff, and unstaged diff in one response. Mutation methods return a discriminated response so a future browser surface can render success and failure without parsing command output.

| Operation | Controller method | Confirmation |
|---|---|---|
| Inspect | `snapshot()` | Not required |
| Branch | `createBranch()`, `switchBranch()` | Not required |
| Stage | `stage()` | Not required |
| Unstage | `unstage()` | Not required |
| Commit | `commit()` | Local mutation; message required |
| Push | `push()` | `confirmed: true` required |

Mutations are serialized through a small promise queue. This prevents a rapid sequence of stage, commit, or push clicks from racing against one another.

## Boundary

The repository is intentionally a standalone TypeScript package at this stage. Nexuss-Agents remains the host runtime. A browser-facing extension adapter will be added after the local operation contract is finalized; until then, no local repository path or Git credential is exposed through the host application.
