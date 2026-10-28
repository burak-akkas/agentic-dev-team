# Project guide for agents

## What this project is
`tasks-cli` is a tiny Node.js command-line task list (add / done / list) that stores tasks in a JSON file. It's a sandbox project for piloting the agent team. Keep it simple and dependency-free.

## Layout
- `src/tasks.js`: pure task functions (`addTask`, `completeTask`, `listTasks`, `formatTask`) plus JSON `load`/`save`
- `bin/tasks.js`: CLI entry point; `run(argv, { file, out })` is exported for tests
- `test/*.test.js`: tests using the built-in `node:test` runner
- `.github/`, `scripts/`, `templates/`: the agent-team tooling. **Not part of the product; never modify.**

## Commands
- Test (all): `npm test`
- Test (single file): `node --test test/tasks.test.js`
- Run the CLI: `node bin/tasks.js <command>` (set `TASKS_FILE` to use a temporary file)
- No install step: there are no dependencies.

## Conventions
- ES modules, Node >= 20, **no npm dependencies**.
- Business logic goes in `src/` as pure functions (return new arrays, never mutate the input). The CLI only parses args, does I/O and formats output.
- Errors: throw `Error` with a user-facing message; the CLI prints `Error: <message>` and exits with code 1.
- Every behaviour change needs a test in `test/`. Prefer testing pure functions; use `run()` with a temp file for CLI behaviour.
- When CLI usage changes, update the `USAGE` text in `bin/tasks.js` and the README section "tasks-cli".
- Commits: Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`).

## Never
- Modify `.github/`, `scripts/`, `templates/`, secrets or workflow files.
- Add npm dependencies.
- Commit `tasks.json` or other local data files.
