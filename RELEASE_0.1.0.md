# Nexuss-Git 0.1.0 Release

Nexuss-Git 0.1.0 is the first public standalone Nexuss-Git package for the Axolotl Store. The package manifest is `axolotl.manifest.json`, the right-window entrypoint is `public/index.html`, and the immutable source ref is the `v0.1.0` tag.

## Included capabilities

The release includes local repository status, branches, staging, diffs, commits, guarded pushes, safety previews, append-only audit history, verified GitHub webhook intake, normalized CI/CD events, and explicitly confirmed workflow trigger records.

## Store metadata

| Field | Value |
|---|---|
| App ID | `nexuss-git` |
| Version | `0.1.0` |
| Surface | `right-window` |
| Entrypoint | `public/index.html` |
| Minimum width | 320px |
| Default width | 440px |
| Source | `https://github.com/nexuss0781/Nexuss-Git` |
| Source ref | `v0.1.0` |

## Host integration

Nexuss-Agents already registers the Nexuss-Git launcher through the Right Window extension registry. Its release descriptor now records the published app ID, version, source repository, launch surface, and window dimensions. The host-side component remains the integration adapter; the standalone package owns the local browser workspace and operation contracts.

## Deployment requirements

Before production use, deploy Nexuss-Agents and redeploy any central authentication or GitHub API service required by the host integration. For webhook intake, configure `GITHUB_WEBHOOK_SECRET` behind a trusted HTTPS ingress. The standalone local server binds to loopback by default.

## Release boundary

This release does not silently dispatch workflows, bypass protected branches, execute repository code, persist GitHub tokens, or replace independent GitHub review. Future changes should be released as a new version rather than appended to the 0.1.0 acceptance scope.
