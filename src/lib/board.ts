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
}

export interface Board {
  columns: Record<ColumnId, Card[]>;
  // Cards removed from Done with "Archive done", oldest first.
  archive: Card[];
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
    columns: { ...board.columns, done: [...back, ...board.columns.done] },
    archive: board.archive.filter((c) => !ids.has(c.id)),
  };
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

// Neighbouring column, for the "move left / right" buttons.
export function adjacentColumn(column: ColumnId, direction: -1 | 1): ColumnId | undefined {
  const index = COLUMNS.findIndex((c) => c.id === column);
  return COLUMNS[index + direction]?.id;
}
