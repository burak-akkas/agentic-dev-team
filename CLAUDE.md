# Project guide for agents

## What this project is
A template for a label-driven agent team (Analyst → Architect → Implementor ⇄ Reviewer) that runs on GitHub Actions with `anthropics/claude-code-action`. This repository is also the pilot that tests the template on itself.

## Layout
- `.github/agents/`: role prompts and `transition.sh` (agents must not modify these)
- `.github/workflows/`: one workflow per role (agents must not modify these)
- `scripts/`: Bash helper scripts for setting up a repo
- `templates/`: files other repos copy, e.g. `templates/CLAUDE.md`
- `README.md`: setup guide and how the pipeline works

## Commands
- Syntax-check a shell script: `bash -n <file>`
- There is no build and no test suite. For script changes, include a "How to verify" section in the PR.

## Conventions
- Bash: start with `#!/usr/bin/env bash` and `set -euo pipefail`, put a usage comment at the top, quote all variables.
- Keep scripts small and dependency-free (only `gh`, `jq`, `git`).
- When behaviour or setup changes, update `README.md` in the same PR.
- Commits: Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`).

## Never
- Modify `.github/`, secrets or workflow files.
- Commit credentials, tokens or `.pem` files.
