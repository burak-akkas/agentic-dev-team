// Pure board logic. Every function returns a new board and never mutates its input.

export type ColumnId = "todo" | "doing" | "done";

export type Priority = "low" | "medium" | "high";

export interface Card {
  id: string;
  title: string;
  createdAt: string;
  priority: Priority;
  // Optional date-only due date, `YYYY-MM-DD` (local calendar day).
  dueDate?: string;
  // Optional multi-line plain-text notes (trimmed, at most MAX_NOTES_LENGTH characters).
  notes?: string;
  // Optional labels (trimmed, unique case-insensitively, each at most MAX_LABEL_LENGTH characters).
  labels?: string[];
  // Optional comments, oldest first.
  comments?: CardComment[];
}

export interface CardComment {
  id: string;
  // Trimmed, at most MAX_COMMENT_LENGTH characters.
  text: string;
  createdAt: string;
  editedAt?: string;
}

export interface Board {
  columns: Record<ColumnId, Card[]>;
  // Cards removed from Done with "Archive done", oldest first.
  archive: Card[];
  // Optional soft WIP limits per column (whole numbers from 1 to MAX_WIP_LIMIT). Never blocks anything.
  wipLimits?: Partial<Record<ColumnId, number>>;
}

export const COLUMNS: readonly { id: ColumnId; title: string }[] = [
  { id: "todo", title: "To do" },
  { id: "doing", title: "Doing" },
  { id: "done", title: "Done" },
];

export const PRIORITIES: readonly { id: Priority; label: string }[] = [
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
];

export const DEFAULT_PRIORITY: Priority = "medium";

export const MAX_TITLE_LENGTH = 120;

export const MAX_NOTES_LENGTH = 1000;

export const MAX_COMMENT_LENGTH = 1000;

export const MAX_LABEL_LENGTH = 20;

export const MAX_WIP_LIMIT = 99;

export function emptyBoard(): Board {
  return { columns: { todo: [], doing: [], done: [] }, archive: [] };
}

function normalizeTitle(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) {
    throw new Error("Card title must not be empty");
  }
  if (trimmed.length > MAX_TITLE_LENGTH) {
    throw new Error(`Card title must be at most ${MAX_TITLE_LENGTH} characters`);
  }
  return trimmed;
}

export function addCard(
  board: Board,
  title: string,
  { id = crypto.randomUUID(), now = new Date() }: { id?: string; now?: Date } = {},
): Board {
  const card: Card = {
    id,
    title: normalizeTitle(title),
    createdAt: now.toISOString(),
    priority: DEFAULT_PRIORITY,
  };
  return { ...board, columns: { ...board.columns, todo: [...board.columns.todo, card] } };
}

export function setPriority(board: Board, cardId: string, priority: Priority): Board {
  const found = findCard(board, cardId);
  if (!found) {
    throw new Error(`Card ${cardId} not found`);
  }
  if (found.card.priority === priority) {
    return board;
  }
  return {
    ...board,
    columns: {
      ...board.columns,
      [found.column]: board.columns[found.column].map((c) => (c.id === cardId ? { ...c, priority } : c)),
    },
  };
}

export function renameCard(board: Board, cardId: string, title: string): Board {
  const found = findCard(board, cardId);
  if (!found) {
    throw new Error(`Card ${cardId} not found`);
  }
  const trimmed = normalizeTitle(title);
  if (trimmed === found.card.title) {
    return board;
  }
  return {
    ...board,
    columns: {
      ...board.columns,
      [found.column]: board.columns[found.column].map((c) => (c.id === cardId ? { ...c, title: trimmed } : c)),
    },
  };
}

export function findCard(board: Board, cardId: string): { card: Card; column: ColumnId } | undefined {
  for (const { id: column } of COLUMNS) {
    const card = board.columns[column].find((c) => c.id === cardId);
    if (card) {
      return { card, column };
    }
  }
  return undefined;
}

export function moveCard(board: Board, cardId: string, to: ColumnId): Board {
  const found = findCard(board, cardId);
  if (!found) {
    throw new Error(`Card ${cardId} not found`);
  }
  if (found.column === to) {
    return board;
  }
  return {
    ...board,
    columns: {
      ...board.columns,
      [found.column]: board.columns[found.column].filter((c) => c.id !== cardId),
      [to]: [...board.columns[to], found.card],
    },
  };
}

export function deleteCard(board: Board, cardId: string): Board {
  const found = findCard(board, cardId);
  if (!found) {
    throw new Error(`Card ${cardId} not found`);
  }
  return {
    ...board,
    columns: {
      ...board.columns,
      [found.column]: board.columns[found.column].filter((c) => c.id !== cardId),
    },
  };
}

// Moves every Done card to the end of the archive. Returns the same board when Done is empty.
export function archiveDone(board: Board): Board {
  if (board.columns.done.length === 0) {
    return board;
  }
  return {
    ...board,
    columns: { ...board.columns, done: [] },
    archive: [...board.archive, ...board.columns.done],
  };
}

// Moves an archived card to the end of Done.
export function restoreCard(board: Board, cardId: string): Board {
  const card = board.archive.find((c) => c.id === cardId);
  if (!card) {
    throw new Error(`Archived card ${cardId} not found`);
  }
  return {
    ...board,
    columns: { ...board.columns, done: [...board.columns.done, card] },
    archive: board.archive.filter((c) => c.id !== cardId),
  };
}

export function deleteArchived(board: Board, cardId: string): Board {
  if (!board.archive.some((c) => c.id === cardId)) {
    throw new Error(`Archived card ${cardId} not found`);
  }
  return { ...board, archive: board.archive.filter((c) => c.id !== cardId) };
}

// Undoes `archiveDone`: puts the given cards back at the start of Done, in order.
// Cards no longer in the archive (restored or deleted meanwhile) are skipped.
export function undoArchive(board: Board, cards: Card[]): Board {
  const inArchive = new Set(board.archive.map((c) => c.id));
  const back = cards.filter((c) => inArchive.has(c.id));
  if (back.length === 0) {
    return board;
  }
  const ids = new Set(back.map((c) => c.id));
  return {
    ...board,
    columns: { ...board.columns, done: [...back, ...board.columns.done] },
    archive: board.archive.filter((c) => !ids.has(c.id)),
  };
}

export type WipLimitResult = { ok: true; limit: number | undefined } | { ok: false; error: string };

// Parses the limit editor's text. Blank clears the limit; otherwise a whole number from 1 to MAX_WIP_LIMIT.
export function parseWipLimit(input: string): WipLimitResult {
  const trimmed = input.trim();
  if (trimmed === "") {
    return { ok: true, limit: undefined };
  }
  const limit = /^\d+$/.test(trimmed) ? Number(trimmed) : NaN;
  if (!(limit >= 1 && limit <= MAX_WIP_LIMIT)) {
    return { ok: false, error: `Enter a whole number from 1 to ${MAX_WIP_LIMIT}.` };
  }
  return { ok: true, limit };
}

export function isValidWipLimit(limit: unknown): limit is number {
  return typeof limit === "number" && Number.isInteger(limit) && limit >= 1 && limit <= MAX_WIP_LIMIT;
}

// Sets, changes or (with `undefined`) clears a column's WIP limit. The key is removed once no limit is left.
export function setWipLimit(board: Board, column: ColumnId, limit: number | undefined): Board {
  if (limit !== undefined && !isValidWipLimit(limit)) {
    throw new Error(`WIP limit must be a whole number from 1 to ${MAX_WIP_LIMIT}`);
  }
  if (board.wipLimits?.[column] === limit) {
    return board;
  }
  const { wipLimits, ...rest } = board;
  const next = { ...wipLimits };
  if (limit === undefined) {
    delete next[column];
  } else {
    next[column] = limit;
  }
  return Object.keys(next).length === 0 ? rest : { ...rest, wipLimits: next };
}

export type WipState = "none" | "ok" | "at" | "over";

// How a column's real card count compares to its limit. `over` is how many cards exceed it.
export function wipStatus(count: number, limit: number | undefined): { state: WipState; over: number } {
  if (limit === undefined) {
    return { state: "none", over: 0 };
  }
  if (count > limit) {
    return { state: "over", over: count - limit };
  }
  return { state: count === limit ? "at" : "ok", over: 0 };
}

export function isValidDueDate(date: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) {
    return false;
  }
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const parsed = new Date(year, month - 1, day);
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day;
}

// Sets, changes or (with `undefined`) clears a card's due date.
export function setDueDate(board: Board, cardId: string, date: string | undefined): Board {
  const found = findCard(board, cardId);
  if (!found) {
    throw new Error(`Card ${cardId} not found`);
  }
  if (date !== undefined && !isValidDueDate(date)) {
    throw new Error("Due date must be a valid YYYY-MM-DD date");
  }
  if (found.card.dueDate === date) {
    return board;
  }
  const updated: Card = { ...found.card, dueDate: date };
  if (date === undefined) {
    delete updated.dueDate;
  }
  return {
    ...board,
    columns: {
      ...board.columns,
      [found.column]: board.columns[found.column].map((c) => (c.id === cardId ? updated : c)),
    },
  };
}

// Sets, changes or clears a card's notes. Blank notes (or `undefined`) clear them.
export function setNotes(board: Board, cardId: string, notes: string | undefined): Board {
  const found = findCard(board, cardId);
  if (!found) {
    throw new Error(`Card ${cardId} not found`);
  }
  const trimmed = notes?.trim() || undefined;
  if (trimmed !== undefined && trimmed.length > MAX_NOTES_LENGTH) {
    throw new Error(`Card notes must be at most ${MAX_NOTES_LENGTH} characters`);
  }
  if (found.card.notes === trimmed) {
    return board;
  }
  const updated: Card = { ...found.card, notes: trimmed };
  if (trimmed === undefined) {
    delete updated.notes;
  }
  return {
    ...board,
    columns: {
      ...board.columns,
      [found.column]: board.columns[found.column].map((c) => (c.id === cardId ? updated : c)),
    },
  };
}

function normalizeCommentText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("Comment must not be empty");
  }
  if (trimmed.length > MAX_COMMENT_LENGTH) {
    throw new Error(`Comment must be at most ${MAX_COMMENT_LENGTH} characters`);
  }
  return trimmed;
}

// Replaces a card's comments. An empty list removes the field.
function withComments(board: Board, cardId: string, comments: CardComment[]): Board {
  const found = findCard(board, cardId);
  if (!found) {
    throw new Error(`Card ${cardId} not found`);
  }
  const updated: Card = { ...found.card, comments };
  if (comments.length === 0) {
    delete updated.comments;
  }
  return {
    ...board,
    columns: {
      ...board.columns,
      [found.column]: board.columns[found.column].map((c) => (c.id === cardId ? updated : c)),
    },
  };
}

function findComment(board: Board, cardId: string, commentId: string): CardComment[] {
  const found = findCard(board, cardId);
  if (!found) {
    throw new Error(`Card ${cardId} not found`);
  }
  const comments = found.card.comments ?? [];
  if (!comments.some((c) => c.id === commentId)) {
    throw new Error(`Comment ${commentId} not found`);
  }
  return comments;
}

// Appends a comment (oldest first). Throws on blank or over-long text.
export function addComment(
  board: Board,
  cardId: string,
  text: string,
  { id = crypto.randomUUID(), now = new Date() }: { id?: string; now?: Date } = {},
): Board {
  const found = findCard(board, cardId);
  if (!found) {
    throw new Error(`Card ${cardId} not found`);
  }
  const comment: CardComment = { id, text: normalizeCommentText(text), createdAt: now.toISOString() };
  return withComments(board, cardId, [...(found.card.comments ?? []), comment]);
}

// Changes a comment's text and marks it edited. Unchanged text returns the same board.
export function editComment(
  board: Board,
  cardId: string,
  commentId: string,
  text: string,
  { now = new Date() }: { now?: Date } = {},
): Board {
  const comments = findComment(board, cardId, commentId);
  const trimmed = normalizeCommentText(text);
  if (comments.find((c) => c.id === commentId)?.text === trimmed) {
    return board;
  }
  return withComments(
    board,
    cardId,
    comments.map((c) => (c.id === commentId ? { ...c, text: trimmed, editedAt: now.toISOString() } : c)),
  );
}

export function deleteComment(board: Board, cardId: string, commentId: string): Board {
  const comments = findComment(board, cardId, commentId);
  return withComments(
    board,
    cardId,
    comments.filter((c) => c.id !== commentId),
  );
}

export function normalizeLabel(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Label must not be empty");
  }
  if (trimmed.length > MAX_LABEL_LENGTH) {
    throw new Error(`Label must be at most ${MAX_LABEL_LENGTH} characters`);
  }
  return trimmed;
}

const sameLabel = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

// Returns a new list with the label added at the end. Throws on empty, too long or duplicate (case-insensitive).
export function addLabelToList(labels: readonly string[], name: string): string[] {
  const label = normalizeLabel(name);
  if (labels.some((l) => sameLabel(l, label))) {
    throw new Error(`Label "${label}" already exists`);
  }
  return [...labels, label];
}

export function removeLabelFromList(labels: readonly string[], name: string): string[] {
  return labels.filter((l) => !sameLabel(l, name.trim()));
}

// Replaces a card's labels. An empty list (or `undefined`) removes the field.
export function setLabels(board: Board, cardId: string, labels: readonly string[] | undefined): Board {
  const found = findCard(board, cardId);
  if (!found) {
    throw new Error(`Card ${cardId} not found`);
  }
  let next: string[] = [];
  for (const name of labels ?? []) {
    next = addLabelToList(next, name);
  }
  const current = found.card.labels ?? [];
  if (current.length === next.length && current.every((l, i) => l === next[i])) {
    return board;
  }
  const updated: Card = { ...found.card, labels: next };
  if (next.length === 0) {
    delete updated.labels;
  }
  return {
    ...board,
    columns: {
      ...board.columns,
      [found.column]: board.columns[found.column].map((c) => (c.id === cardId ? updated : c)),
    },
  };
}

// Full class strings (not built dynamically) so Tailwind can see them.
export const LABEL_PALETTE: readonly string[] = [
  "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
  "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
  "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
  "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300",
  "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/40 dark:text-fuchsia-300",
  "bg-lime-100 text-lime-800 dark:bg-lime-900/40 dark:text-lime-300",
];

// Deterministic, case-insensitive color classes for a label name.
export function labelColor(name: string): string {
  let hash = 0;
  for (const char of name.trim().toLowerCase()) {
    hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
  }
  return LABEL_PALETTE[hash % LABEL_PALETTE.length];
}

// Distinct labels in use on the board (first spelling wins), sorted alphabetically.
export function boardLabels(board: Board): string[] {
  const seen = new Map<string, string>();
  for (const { id: column } of COLUMNS) {
    for (const card of board.columns[column]) {
      for (const label of card.labels ?? []) {
        const key = label.toLowerCase();
        if (!seen.has(key)) {
          seen.set(key, label);
        }
      }
    }
  }
  return [...seen.values()].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
}

// Only cards having the label (case-insensitive). A `null` label returns the same board.
export function filterByLabel(board: Board, label: string | null): Board {
  if (label === null) {
    return board;
  }
  const has = (c: Card) => (c.labels ?? []).some((l) => sameLabel(l, label));
  return {
    ...board,
    columns: {
      todo: board.columns.todo.filter(has),
      doing: board.columns.doing.filter(has),
      done: board.columns.done.filter(has),
    },
  };
}

export interface CardEdits {
  title: string;
  notes: string | undefined;
  priority: Priority;
  dueDate: string | undefined;
  column: ColumnId;
  labels?: string[];
}

// Applies every edit at once. Validates first (the setters throw), so nothing is half-applied.
export function updateCard(board: Board, cardId: string, edits: CardEdits): Board {
  let next = renameCard(board, cardId, edits.title);
  next = setNotes(next, cardId, edits.notes);
  if (edits.labels !== undefined) {
    next = setLabels(next, cardId, edits.labels);
  }
  next = setPriority(next, cardId, edits.priority);
  next = setDueDate(next, cardId, edits.dueDate);
  return moveCard(next, cardId, edits.column);
}

// Whether a dialog draft differs from the stored card. Whitespace-only differences in title/notes don't count.
export function hasChanges(card: Card, column: ColumnId, draft: CardEdits): boolean {
  return (
    draft.title.trim() !== card.title ||
    (draft.notes?.trim() || undefined) !== card.notes ||
    draft.priority !== card.priority ||
    (draft.dueDate || undefined) !== card.dueDate ||
    draft.column !== column ||
    (draft.labels !== undefined &&
      (draft.labels.length !== (card.labels ?? []).length ||
        draft.labels.some((l, i) => l.trim() !== (card.labels ?? [])[i])))
  );
}

// Local calendar day as `YYYY-MM-DD`.
export function todayString(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${String(now.getFullYear()).padStart(4, "0")}-${month}-${day}`;
}

// Overdue = due before today and not in Done. Due today is not overdue.
export function isOverdue(card: Card, column: ColumnId, today: string = todayString()): boolean {
  return column !== "done" && !!card.dueDate && card.dueDate < today;
}

// Short readable date (e.g. "Oct 28"). Parsed as a local date so the day never shifts by timezone.
export function formatDueDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function isFiltering(query: string): boolean {
  return query.trim() !== "";
}

// Cards whose title contains the query (case-insensitive, trimmed). A blank query returns the same board.
export function filterCards(board: Board, query: string): Board {
  if (!isFiltering(query)) {
    return board;
  }
  const q = query.trim().toLowerCase();
  return {
    ...board,
    columns: {
      todo: board.columns.todo.filter((c) => c.title.toLowerCase().includes(q)),
      doing: board.columns.doing.filter((c) => c.title.toLowerCase().includes(q)),
      done: board.columns.done.filter((c) => c.title.toLowerCase().includes(q)),
    },
  };
}

export interface BoardStats {
  total: number;
  done: number;
  // Share of cards in Done, rounded to a whole percent (0 for an empty board).
  percentDone: number;
  overdue: number;
  // High priority cards that are not in Done.
  highOpen: number;
}

export function boardStats(board: Board, today: string = todayString()): BoardStats {
  let total = 0;
  let overdue = 0;
  let highOpen = 0;
  for (const { id: column } of COLUMNS) {
    for (const card of board.columns[column]) {
      total += 1;
      if (isOverdue(card, column, today)) {
        overdue += 1;
      }
      if (column !== "done" && card.priority === "high") {
        highOpen += 1;
      }
    }
  }
  const done = board.columns.done.length;
  return { total, done, percentDone: total === 0 ? 0 : Math.round((done / total) * 100), overdue, highOpen };
}

// Only the overdue cards (due before today, not in Done).
export function filterOverdue(board: Board, today: string = todayString()): Board {
  return {
    ...board,
    columns: {
      todo: board.columns.todo.filter((c) => isOverdue(c, "todo", today)),
      doing: board.columns.doing.filter((c) => isOverdue(c, "doing", today)),
      done: [],
    },
  };
}

// Neighbouring column, for the "move left / right" buttons.
export function adjacentColumn(column: ColumnId, direction: -1 | 1): ColumnId | undefined {
  const index = COLUMNS.findIndex((c) => c.id === column);
  return COLUMNS[index + direction]?.id;
}
