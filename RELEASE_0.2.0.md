# Nexuss-Git 0.2.0 Release

Nexuss-Git 0.2.0 establishes the standalone repository as the source of truth for the Nexuss-Agent extension. The release keeps the standalone Git workspace and safety engine while adding a synchronized snapshot of the host-facing Nexuss-Git application under `host/`.

## Included changes

- Synchronized the current Nexuss-Agent Nexuss-Git application components into `host/components/`.
- Synchronized the right-window release descriptor and bridge contract into `host/lib/`.
- Documented the extension boundary between Nexuss-Git, Nexuss-Agent, Axolotl Store, and Nexuss-Auth.
- Updated the Axolotl manifest to immutable source ref `v0.2.0`.
- Documented the release process that prevents future host-only Nexuss-Git changes from becoming unsynchronized.

## Store metadata

| Field | Value |
|---|---|
| App ID | `nexuss-git` |
| Version | `0.2.0` |
| Surface | `right-window` |
| Entrypoint | `public/index.html` |
| Minimum width | 320px |
| Default width | 440px |
| Source | `https://github.com/nexuss0781/Nexuss-Git` |
| Source ref | `v0.2.0` |

## Synchronization boundary

Nexuss-Git owns its standalone operation contracts, package manifest, release metadata, and host integration snapshot. Nexuss-Agent owns the host runtime, authenticated server procedures, Axolotl Store lifecycle, and deployment environment.

The `host/` directory is intentionally a source snapshot for the host bridge. Before a future release, host-side Nexuss-Git changes must be copied into this repository, reviewed, tested, and released from a new immutable tag. Nexuss-Agent’s catalog must then be updated to that tag.

## Validation

Before publishing this release, run:

```bash
npm run check
npm test
```

The host repository must also pass its type check and production build after its catalog is updated to `v0.2.0`.

## Deployment note

The current package archive is consumed from the tagged GitHub source by Axolotl Store. Project codebases and installed package state require persistent deployment storage in Nexuss-Agent; this release does not claim that a Render local filesystem survives redeployment.
