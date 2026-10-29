# Project structure

Where things live and where new code and tests go.

## Source (`src/`)

| Folder | Contents |
|---|---|
| `src/app/` | App Router entry: `layout.tsx`, `page.tsx`, `globals.css`. |
| `src/components/app/` | App-level controls (board switcher, import/export, theme toggle, keyboard shortcuts). |
| `src/components/board/` | The board and its lists (columns, add-card form, search, summary, undo toast). |
| `src/components/card/` | Card UI (item, dialog, checklist, comments, activity, labels). |
| `src/components/panels/` | Side panels (archive, insights, templates). |
| `src/components/views/` | Alternative views (table, calendar) and the view switch. |
| `src/components/ui/` | Generic building blocks (`Button`, `Dialog`, `Input`, `Surface`, `Toast`), exported from `index.ts`. |
| `src/hooks/` | React hooks (`useBoard`, `useTheme`). |
| `src/lib/board/` | Pure board logic, one module per domain (`cards`, `lists`, `labels`, …). `index.ts` re-exports it, so import from `@/lib/board`. |
| `src/lib/` | Other pure helpers (`storage`, `boards`, `calendar`, `chart`, `insights`, `tableView`, `templates`, `theme`, `time`). |

## Tests (`tests/`)

| Folder | Contents |
|---|---|
| `tests/unit/` | Vitest tests. The tree mirrors `src/`. |
| `tests/e2e/` | Playwright specs, one file per user-visible flow (`<feature>.spec.ts`). |
| `tests/support/` | Helpers: `serve.mjs` (serves `out/`), `testStorage.ts`, `vitest.setup.ts`. |

## Where new code goes

- **Board logic:** a pure function in the matching `src/lib/board/<domain>.ts` module (or a new module, re-exported from `index.ts`). It returns a new board and never mutates its input. Keep `src/lib/` free of React and browser APIs, except `storage.ts`.
- **Other pure helper:** a new file in `src/lib/`.
- **Hook:** `src/hooks/use<Name>.ts`.
- **Component:** in the feature folder under `src/components/` that fits best. Generic, reusable pieces go in `ui/`. Interactive components start with `"use client"`.

## Where new tests go

- **Unit/component test:** `tests/unit/<same path as the source file>`, named after the module, e.g. `src/lib/board/cards.ts` is tested in `tests/unit/lib/board/cards.test.ts`. Extra files for one module use a suffix (`cards.duplicate.test.ts`). Import code with the `@/` alias.
- **End-to-end test:** `tests/e2e/<feature>.spec.ts`. Navigate with `page.goto("./")` and select elements by role or label.
- **Shared test helper:** `tests/support/`.
