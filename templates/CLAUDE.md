# Project guide for agents

> Template: replace every `<...>`. Every agent reads this file on every run, so keep it short and specific.

## What this project is
<one paragraph: purpose, main users, tech stack>

## Layout
- `<src/...>`: <what lives here>
- `<tests/...>`: <test layout>

## Commands
- Install: `<npm ci | pip install -e .[dev] | ...>`
- Build: `<...>`
- Lint/format: `<...>`
- Test (all): `<...>`
- Test (single): `<...>`

> Each command above must also be allowed in the repo variable `AGENT_BUILD_TOOLS`,
> e.g. `Bash(npm ci:*),Bash(npm test:*),Bash(npm run lint:*)`.

## Conventions
- <language/style rules a linter does not enforce>
- <error handling, logging, naming patterns>
- Commits: Conventional Commits (`feat:`, `fix:`, `chore:` ...)
- Every behaviour change ships with a test.

## Architecture rules
- <boundaries, e.g. "UI never calls the DB directly", "no new dependencies without an ADR">

## Testing notes for agents (optional)
<!-- Helps the Reviewer and QA find side effects. Keep it short. -->
- Where data lives: <e.g. database tables, local storage keys, files, external services>
- What counts as "other" data that an action must never touch: <e.g. other users, other tenants, other projects>
- Risky areas: <e.g. migrations, billing, anything that deletes>

## Never
- Modify `.github/`, secrets, CI config or deployment files.
- Change public APIs or DB schemas unless the Architect's design says so explicitly.
