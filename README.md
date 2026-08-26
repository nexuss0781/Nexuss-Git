# Nexuss-Git

> A local-first repository workbench for Nexuss-Agent, designed to make everyday Git and GitHub operations understandable, reviewable, and safe.

Nexuss-Git is the standalone repository workspace application maintained by [Nexuss](https://github.com/nexuss0781). It provides a focused surface for inspecting a repository, reviewing local work, managing branches, browsing files, reviewing pull requests, observing CI activity, and preparing guarded Git mutations without requiring users to assemble long command-line sequences.

The repository is both a standalone Git workspace and the source-of-truth release repository for the Nexuss-Agent extension named `nexuss-git`.

## Product position

Nexuss-Git is intentionally narrower than a general-purpose IDE. Its purpose is to provide a reliable repository workbench inside the Nexuss-Agent workspace while keeping destructive or publish operations explicit.

The application separates three concerns:

| Concern | Responsibility |
| --- | --- |
| Repository workspace | Reads Git state, computes status and diffs, manages branches, stages files, creates commits, and performs guarded pushes. |
| Nexuss-Git application | Presents repository information through a compact workbench with repository, file, search, pull-request, changes, activity, analytics, and CI views. |
| Nexuss-Agent integration | Hosts Nexuss-Git in the right-window extension surface, supplies authenticated GitHub operations through server-owned procedures, and passes the current project context without exposing credentials. |

## Capabilities

Nexuss-Git includes the following user-facing areas:

- **Overview** provides repository identity, connection state, branch context, and high-level workspace signals.
- **Repo** lists available GitHub repositories and supports repository creation, renaming, and guarded deletion for repositories owned by the connected account.
- **Search** provides repository code search through the authenticated GitHub integration.
- **Files** presents a repository tree and file viewer for inspecting source files and their selected branch.
- **Pull** presents pull requests, changed files, and review-comment workflows.
- **Changes** inspects the local project workspace, shows staged and unstaged work, renders expandable diffs, and supports Ardi-assisted commit-message drafting.
- **Branches** lists branch information and protected-branch status.
- **Activity** presents repository activity as a chronological work timeline.
- **Analytics** summarizes repository metrics, commits, pull requests, contributors, and workflow outcomes.
- **CI** presents workflow runs, jobs, and available workflow-log information.

A clean working tree is a successful state. Nexuss-Git reports that the repository is clean instead of treating the absence of changes as an error.

## Repository architecture

The repository contains two complementary surfaces.

```text
src/
  gitWorkspace.ts          Low-level, argument-safe Git operation boundary
  workspaceController.ts   Structured facade for UI and API consumers
  auditJournal.ts          Append-only operation journal
  cicdIntegration.ts       CI/CD status and webhook-related workflows
  server.ts                Standalone local JSON API

public/
  index.html               Standalone browser workspace shell
  app.js                   Standalone browser client
  styles.css               Standalone visual system
  icon.svg                 Nexuss-Git application icon

host/
  components/              Synchronized Nexuss-Agent extension components
  lib/                     Synchronized host bridge and release contract

axolotl.manifest.json      Versioned Axolotl Store package manifest
release/                   Reproducible release archives and checksums
```

### Git workspace boundary

`GitWorkspace` is the lowest-level operation boundary. It invokes Git through an argument array rather than a shell, confines repository paths to the selected root, validates branch names and paths, bounds commit messages, and exposes structured errors.

`WorkspaceController` is the UI-facing facade. It serializes mutations and returns structured success or failure responses so a caller can render a stable state, show a precise error, and retry without losing the current workspace context.

The standalone service records operations through an append-only audit journal. Pushes and other consequential mutations require explicit confirmation, and protected branches are rejected by policy.

## Standalone operation

The standalone browser workspace runs against a repository directory selected by the server process.

```bash
npm install
NEXUSS_REPOSITORY_ROOT=/path/to/repository npm start
```

Open [http://127.0.0.1:4174](http://127.0.0.1:4174) after the server starts.

The standalone API exposes structured endpoints for snapshot inspection, branch operations, staging, commits, pushes, operation previews, and audit history. The server binds to loopback by default. Do not expose it to a network without adding an authenticated deployment boundary.

## Nexuss-Agent extension integration

The Axolotl Store manifest identifies Nexuss-Git as a versioned `nexuss.application` package:

```json
{
  "id": "nexuss-git",
  "name": "Nexuss-Git",
  "source": {
    "type": "github",
    "repository": "https://github.com/nexuss0781/Nexuss-Git",
    "ref": "v0.1.0"
  },
  "launch": {
    "surface": "right-window",
    "entrypoint": "public/index.html",
    "resizable": true
  }
}
```

The `host/` directory contains the synchronized Nexuss-Agent extension implementation used during the current integration transition. It mirrors the host-side Nexuss-Git application components and the right-window bridge contract. The standalone repository is the source of truth for future extension releases; Nexuss-Agent should consume a tagged package through Axolotl Store rather than receiving ad hoc feature edits in the host repository.

The host bridge may provide non-secret project context such as project identity, source type, and GitHub source URL. Authentication grants, provider keys, and GitHub access tokens remain server-owned and are never included in extension context.

## Extension contract

Nexuss-Git expects the host to provide:

| Contract | Meaning |
| --- | --- |
| Right-window surface | A resizable application area beside the main Nexuss-Agent conversation. |
| Project context | The currently navigated project, when available, including non-secret Git metadata. |
| GitHub procedures | Server-side repository, branch, file, pull-request, CI, and local-workspace operations. |
| Lifecycle state | Install, enable, disable, update, and uninstall state supplied by Axolotl Store. |
| Explicit mutation controls | User confirmation for repository deletion, commit-and-push, pull-request comments, and other consequential actions. |

Manual repository and branch selection remains available. Current project context is a helper default, not a forced selection.

## Security model

Nexuss-Git treats repository mutations as privileged operations.

- Git commands are executed through `execFile`-style argument passing; the application does not construct shell command strings for execution.
- Repository paths are confined to the configured workspace root.
- Branch names, file paths, repository names, and commit messages are validated and length-bounded.
- Credentials and GitHub grants remain on the server side.
- Local changes are read and processed by server-owned operations.
- Pushes require explicit confirmation and protected branches are guarded.
- Repository deletion requires account ownership, the required GitHub authorization, and an exact user-entered command in the Nexuss-Git confirmation field:

  ```text
  sudo delete repo <repository-name>
  ```

The text is a confirmation protocol, not a shell command. Nexuss-Git never executes the text entered by the user as a terminal command.

## Development

Install dependencies and run the checks:

```bash
npm install
npm run check
npm test
```

The test suite creates temporary repositories and covers Git status parsing, staging, diffs, branch operations, commit behavior, path confinement, confirmation requirements, protected-branch blocking, workspace-controller responses, audit records, and CI/CD integration behavior.

For the standalone browser surface:

```bash
NEXUSS_REPOSITORY_ROOT=/absolute/path/to/repository npm start
```

For host integration work, the synchronized components under `host/` are intentionally written against the Nexuss-Agent React, tRPC, and right-window bridge contracts. They are not intended to run as an independent browser bundle without the host runtime.

## Release process

Nexuss-Git releases are immutable, tagged, and consumed by Axolotl Store through the manifest’s `source.ref`.

1. Implement and test the change in this repository.
2. Update the application version in `package.json`, `axolotl.manifest.json`, and the release metadata.
3. Synchronize the host integration under `host/` with the Nexuss-Agent extension contract.
4. Run the type check and test suite.
5. Build the standalone package and produce a checksum.
6. Commit the release metadata.
7. Create an immutable Git tag such as `v0.2.0`.
8. Publish the release archive and checksum.
9. Update Axolotl Store’s catalog to the new manifest tag.
10. Install or update Nexuss-Git through Axolotl Store and verify lifecycle state, bridge context, and mutation guards.

The host repository should not become the primary development location for Nexuss-Git features. Temporary host-side integration changes must be synchronized back into this repository before a release is declared.

## Current release

The current manifest release is **0.2.0**. It is the synchronized release containing the standalone Git workspace, safety journal, guarded actions, CI/CD integration, Axolotl Store package metadata, and the current Nexuss-Agent host integration snapshot under `host/`.

Future releases should use a new immutable version tag rather than modifying the contents addressed by an existing tag.

## License

This repository is currently maintained as a private-to-the-product source repository for Nexuss and Nexuss-Agent integration. Add a license file before distributing Nexuss-Git outside the Nexuss product family.

## Related projects

- [Nexuss-Agent](https://github.com/nexuss0781/Nexuss-Agents) — the host AI workspace and Axolotl Store runtime.
- [Nexuss-Auth](https://github.com/nexuss0781/nexuss-auth) — the central authentication and GitHub authorization service.
- [Nexuss-Git](https://github.com/nexuss0781/Nexuss-Git) — this standalone repository workspace and extension release source.
