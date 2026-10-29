# Project guide for agents

## What this project is
**Kanban**: a small Kanban board web app (To do / Doing / Done) built with **Next.js 16 (App Router), React 19, TypeScript and Tailwind CSS 4**. It's a static export (`output: "export"`) deployed to GitHub Pages on every merge, with cards saved in the browser's `localStorage`. There is no backend.

> **Read [AGENTS.md](AGENTS.md) first.** This Next.js version is newer than your training data. Check `node_modules/next/dist/docs/` (after `npm ci`) before using any Next.js API you're not sure about.

## Layout
- `src/app/`: App Router entry (`layout.tsx`, `page.tsx`, `globals.css`). Server Components by default.
- `src/components/`: UI components, grouped into `app/`, `board/`, `card/`, `panels/`, `ui/` and `views/`. Interactive ones start with `"use client"`.
- `src/lib/board/`: **pure board logic**, split into domain modules (`cards.ts`, `lists.ts`, `labels.ts` …, types in `types.ts`). `index.ts` re-exports everything, so import from `@/lib/board`. Every function returns a new board and never mutates its input.
- `src/lib/*.ts`: other pure helpers; `storage.ts` handles `localStorage` load/save with validation (corrupt data gives an empty board).
- `src/hooks/`: React hooks (`useBoard`, `useTheme`) connecting components to storage.
- `tests/unit/`: Vitest + Testing Library tests, mirroring the `src/` tree (`tests/unit/lib/board/cards.test.ts` tests `src/lib/board/cards.ts`).
- `tests/e2e/*.spec.ts`: Playwright end-to-end tests against the built site.
- `tests/support/`: test helpers (`serve.mjs` serves `out/` locally, `testStorage.ts`, `vitest.setup.ts`).
- `docs/structure.md`: where new code and tests go.
- `.github/`, `scripts/`, `templates/`: the agent-team tooling. **Not part of the product; never modify.**

## Commands
- Install: `npm ci` (run this first in a fresh checkout)
- Lint: `npm run lint`
- Typecheck: `npm run typecheck`
- Test: `npm test` (single file: `npx vitest run tests/unit/lib/board/cards.test.ts`)
- Build (static export to `out/`): `npm run build`
- E2E (needs a build; uses installed Google Chrome): `npm run e2e`, or against a deployed site: `E2E_BASE_URL=<url ending in /> npx playwright test`
- Everything CI runs: `npm run check` (lint, typecheck, unit tests, build, e2e)

Before pushing, `npm run check` must pass. CI runs the same steps, and the merge gate only merges when CI is green.

## Conventions
- TypeScript strict; no `any`. Use the `@/` import alias for `src/`.
- Business logic goes in `src/lib/` as pure, tested functions. Components stay thin: they call lib functions through `useBoard()`'s `update`.
- No server-only features: no API routes, Server Actions, `cookies()`/`headers()`, dynamic rendering, `cacheComponents` or PPR. They break the static export.
- Persisted data shape changes must stay backward compatible with what `storage.ts` validates, or bump `STORAGE_KEY` and migrate.
- Styling: Tailwind utility classes, and support dark mode (`dark:` variants) for every new UI.
- Accessibility: every interactive element is reachable by keyboard and has an accessible name (tests query by role or label).
- Tests live under `tests/` (never next to the code), following `docs/structure.md`. Every behaviour change needs tests: lib tests for logic, component tests (Testing Library, `userEvent`) for UI behaviour, and an e2e test in `tests/e2e/` for each user-visible flow. In e2e tests, navigate with `page.goto("./")` (never `"/"`) so they also work on PR previews under a sub-path, and select elements by role or label.
- Every PR gets a live preview at `https://burak-akkas.github.io/agentic-dev-team/pr-<N>/`. The QA agent tests it in a real browser against the acceptance criteria before merge.
- New dependencies only when clearly justified in the PR description. Prefer zero.
- Commits: Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `refactor:`).

## Never
- Modify `.github/`, `scripts/`, `templates/`, secrets or workflow files.
- Commit `node_modules/`, `.next/`, `out/`, `playwright-report/`, `test-results/` or `.env*`.
