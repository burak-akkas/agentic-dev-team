# Design system

Kanban's look is zinc neutrals with an indigo accent. It is defined once as **tokens** in `src/app/globals.css` and used through a few **primitives** in `src/components/ui/`.

## Rules
- Use tokens, not raw `zinc-*` / `indigo-*` classes, for anything that has a token. Tokens switch with the theme, so you do not write `dark:` pairs.
- Every token has a light value in `:root` and a dark value in `:root[data-theme="dark"]` (a test enforces this) and is exposed to Tailwind in `@theme inline`.
- Use a primitive before writing a new class string. Primitives forward native props and `ref`, and take a `className` for layout only (margins, width, flex). Do not override their colors.
- Every interactive element needs a keyboard path and an accessible name.
- Semantic status colors (priority badges, overdue, notices) stay as explicit Tailwind colors with `dark:` variants.

## Tokens

| Tailwind utility suffix | CSS variable | Light | Dark | Use |
|---|---|---|---|---|
| `background` / `foreground` | `--background` / `--foreground` | `#fff` / `#171717` | `#0a0a0a` / `#ededed` | Page and default text |
| `surface` | `--surface` | white | zinc-900 | Cards, panels, fields, dialog |
| `surface-muted` | `--surface-muted` | zinc-100 | zinc-800 | Columns, list rows |
| `surface-hover` | `--surface-hover` | zinc-100 | zinc-800 | Hover background of buttons |
| `line` | `--border` | zinc-200 | zinc-800 | Container borders, dividers, progress track |
| `field` | `--border-field` | zinc-300 | zinc-700 | Borders of fields and secondary buttons |
| `muted` | `--text-muted` | zinc-500 | zinc-500 | Hints, counters, empty states |
| `subtle` | `--text-subtle` | zinc-600 | zinc-400 | Labels, secondary text |
| `accent` / `accent-hover` | `--accent` / `--accent-hover` | indigo-600 / 500 | indigo-600 / 500 | Primary actions, focus rings |
| `danger` | `--danger` | red-600 | red-400 | Errors, destructive hover |
| `inverse` / `on-inverse` | `--inverse` / `--on-inverse` | zinc-900 / white | zinc-100 / zinc-900 | Toast, selected theme option |

Example: `bg-surface border border-line text-muted`, `focus:ring-accent/20`.

## Primitives
All are exported from `@/components/ui` (or `./ui` inside `src/components`).

### `Button`
Props: native button props, plus `variant` (`primary` | `secondary` (default) | `ghost` | `danger`) and `size` (`xs` | `sm` | `md` (default)). `type` defaults to `"button"`; pass `type="submit"` explicitly. Forwards `ref`.

```tsx
<Button type="submit" variant="primary" disabled={!title.trim()}>Add card</Button>
<Button variant="ghost" size="xs" aria-label={`Edit "${title}"`}>Edit</Button>
```

- `primary`: the main action of a form. `secondary`: bordered, for standalone actions. `ghost`: low emphasis (Cancel, Clear). `danger`: low emphasis, turns red on hover (Delete).

### `Input`, `Textarea`, `Select`
Props: native props, plus `fieldSize` (`md` default | `sm` for compact fields on cards). Forward `ref`. Always give them a `<label>` or `aria-label`.

```tsx
<label htmlFor="due">Due date</label>
<Input id="due" type="date" className="w-full" />
<Select fieldSize="sm" aria-label="Priority"><option>…</option></Select>
```

### `Dialog`
Props: `labelledBy` (id of the heading that names it), `onRequestClose`, `children`. A modal native `<dialog>`, opened on mount. Escape and backdrop clicks call `onRequestClose`; the parent decides whether (and when) to unmount it. Put padding on the content inside, not on the dialog, so backdrop clicks stay detectable.

```tsx
<Dialog labelledBy={headingId} onRequestClose={requestClose}>
  <form className="flex flex-col gap-4 p-5">
    <h2 id={headingId}>Title</h2>
  </form>
</Dialog>
```

### `Toast`
Props: `children`. A fixed, bottom-centered `role="status"` shell on the inverse colors. Timers and actions belong to the caller (see `UndoToast`).

### `Surface`
Props: native section props. A bordered container on the surface color with padding; give it an `aria-label` so the region is named.

## Possible future components (not built)
Text only, to be added when a feature needs them: select menu with custom styling, badge, tooltip, tabs, empty-state block, confirm dialog, notice/alert.
