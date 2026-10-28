import { COLUMNS, DEFAULT_PRIORITY, emptyBoard, isValidDueDate, MAX_NOTES_LENGTH, PRIORITIES, todayString, type Board, type Card } from "./board";

export const STORAGE_KEY = "kanban-board-v1";

// Cards saved before priorities existed (or with an invalid value) are treated as the default priority.
function isCard(value: unknown): value is Omit<Card, "priority"> & { priority?: unknown } {
  const c = value as Card;
  return (
    typeof c === "object" &&
    c !== null &&
    typeof c.id === "string" &&
    typeof c.title === "string" &&
    typeof c.createdAt === "string" &&
    (c.dueDate === undefined || (typeof c.dueDate === "string" && isValidDueDate(c.dueDate)))
  );
}

export function isBoard(value: unknown): value is Board {
  const columns = (value as Board | null)?.columns;
  return (
    typeof columns === "object" &&
    columns !== null &&
    COLUMNS.every(({ id }) => Array.isArray(columns[id]) && columns[id].every(isCard))
  );
}

// Invalid priorities become the default; invalid or blank notes are dropped (never truncated).
function normalizeCard(card: Card): Card {
  const { notes, ...rest } = card as Card & { notes?: unknown };
  const priority = PRIORITIES.some((p) => p.id === card.priority) ? card.priority : DEFAULT_PRIORITY;
  const trimmed = typeof notes === "string" ? notes.trim() : "";
  const normalized: Card = { ...rest, priority };
  if (trimmed && trimmed.length <= MAX_NOTES_LENGTH) {
    normalized.notes = trimmed;
  }
  return normalized;
}

// Boards saved before archiving have no `archive`; a corrupt one is dropped and invalid cards are skipped.
function normalizeBoard(board: Board): Board {
  const archive: unknown = (board as { archive?: unknown }).archive;
  return {
    columns: {
      todo: board.columns.todo.map(normalizeCard),
      doing: board.columns.doing.map(normalizeCard),
      done: board.columns.done.map(normalizeCard),
    },
    archive: Array.isArray(archive) ? (archive.filter(isCard) as Card[]).map(normalizeCard) : [],
  };
}

export function serializeBoard(board: Board): string {
  return JSON.stringify(board, null, 2);
}

export type ParseResult = { ok: true; board: Board } | { ok: false; error: string };

// Validates exported/imported text with the same rules as localStorage data.
export function parseBoard(text: string): ParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "This file is not valid JSON." };
  }
  if (!isBoard(parsed)) {
    return { ok: false, error: "This file is not a Kanban board export." };
  }
  return { ok: true, board: normalizeBoard(parsed) };
}

export function exportFilename(now: Date = new Date()): string {
  return `kanban-board-${todayString(now)}.json`;
}

// Returns an empty board when storage is unavailable, empty or corrupt.
export function loadBoard(storage: Storage | undefined = globalThis.localStorage): Board {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) {
      return emptyBoard();
    }
    const parsed: unknown = JSON.parse(raw);
    return isBoard(parsed) ? normalizeBoard(parsed) : emptyBoard();
  } catch {
    return emptyBoard();
  }
}

export function saveBoard(board: Board, storage: Storage | undefined = globalThis.localStorage): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(board));
  } catch {
    // Storage full or blocked (e.g. private mode): keep working in memory.
  }
}
