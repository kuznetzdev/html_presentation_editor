# GitHub Packages strategy

## Recommendation

Use GitHub Packages only through **GitHub Container Registry (GHCR)** for this
repository.

Recommended package surface:

- `ghcr.io/kuznetzdev/html_presentation_editor:<tag>`

## Why GHCR is useful here

- this project is an application, not a reusable JavaScript library
- the editor is static and can be served from a tiny container without changing
  architecture
- reviewers and adopters get a one-command entrypoint instead of reconstructing
  local paths manually
- release tags map cleanly to immutable image tags

## What is prepared in-repo

- `Dockerfile` for a static editor image
- `.dockerignore` to keep the image lean
- `.github/workflows/publish-ghcr.yml` to publish on version tags or manual dispatch

## Important GitHub-side note

Based on the current GitHub Packages behavior for personal-account packages:

- the first published GHCR package usually starts private
- after the first publish, set package visibility to `Public` once in GitHub UI
- public GHCR container images can then be pulled anonymously

That makes GHCR a good adoption path for this repository: reviewers can pull a
known-good image without cloning or authenticating.

## Anti-recommendations

Do not publish this repo as:

- an npm package
- a GitHub npm package
- a generic tarball package in GitHub Packages

Why not:

- there is no consumer API surface to import
- the runtime is a deployed artifact, not a library contract
- shipping HTML editor sources through npm adds confusion about the supported
  entrypoint

## Sensible future path

If GitHub Packages is used, keep it limited to:

1. GHCR image publishing on release tags
2. clear tags such as `v0.19.2` and `latest`
3. README instructions that point people to `docker run`

Anything beyond that should be justified by an actual distribution need, not by
package registry availability alone.
