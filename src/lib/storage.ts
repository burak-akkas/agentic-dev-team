import { DEFAULT_BOARD_NAME, initialBoardList, type BoardEntry, type BoardList } from "./boards";
import { addLabelToList, COLUMNS, DEFAULT_PRIORITY, isValidDueDate, isValidWipLimit, MAX_COMMENT_LENGTH, MAX_NOTES_LENGTH, PRIORITIES, todayString, type Board, type Card, type CardComment, type ColumnId } from "./board";

export const STORAGE_KEY = "kanban-boards-v2";
// Only read, to migrate old data; never written or removed.
export const LEGACY_STORAGE_KEY = "kanban-board-v1";

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
  const { notes, labels, comments, ...rest } = card as Card & { notes?: unknown; labels?: unknown; comments?: unknown };
  const priority = PRIORITIES.some((p) => p.id === card.priority) ? card.priority : DEFAULT_PRIORITY;
  const trimmed = typeof notes === "string" ? notes.trim() : "";
  const normalized: Card = { ...rest, priority };
  if (trimmed && trimmed.length <= MAX_NOTES_LENGTH) {
    normalized.notes = trimmed;
  }
  const cleanLabels = normalizeLabels(labels);
  if (cleanLabels.length > 0) {
    normalized.labels = cleanLabels;
  }
  const cleanComments = normalizeComments(comments);
  if (cleanComments.length > 0) {
    normalized.comments = cleanComments;
  }
  return normalized;
}

const isValidDate = (value: unknown): value is string => typeof value === "string" && !Number.isNaN(new Date(value).getTime());

// Keeps valid comments only (stored trimmed, in stored order). Entries with a bad shape, blank or over-long text,
// an invalid `createdAt` or a duplicate id are dropped; an invalid `editedAt` is dropped on its own.
function normalizeComments(value: unknown): CardComment[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const seen = new Set<string>();
  const result: CardComment[] = [];
  for (const entry of value) {
    const c = entry as Partial<Record<keyof CardComment, unknown>> | null;
    if (typeof c !== "object" || c === null || typeof c.id !== "string" || seen.has(c.id)) {
      continue;
    }
    const text = typeof c.text === "string" ? c.text.trim() : "";
    if (!text || text.length > MAX_COMMENT_LENGTH || !isValidDate(c.createdAt)) {
      continue;
    }
    seen.add(c.id);
    const comment: CardComment = { id: c.id, text, createdAt: c.createdAt };
    if (isValidDate(c.editedAt)) {
      comment.editedAt = c.editedAt;
    }
    result.push(comment);
  }
  return result;
}

// Keeps valid labels only: non-strings, blank, over-long and duplicate (case-insensitive) entries are dropped.
function normalizeLabels(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  let result: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") {
      continue;
    }
    try {
      result = addLabelToList(result, entry);
    } catch {
      // invalid or duplicate: skip it
    }
  }
  return result;
}

// Boards saved before archiving have no `archive`; a corrupt one is dropped and invalid cards are skipped.
function normalizeBoard(board: Board): Board {
  const archive: unknown = (board as { archive?: unknown }).archive;
  // Invalid WIP limits are dropped; the key is only present when at least one limit is valid.
  const limits: unknown = (board as { wipLimits?: unknown }).wipLimits;
  const wipLimits: Partial<Record<ColumnId, number>> = {};
  if (typeof limits === "object" && limits !== null) {
    for (const { id } of COLUMNS) {
      const limit = (limits as Record<string, unknown>)[id];
      if (isValidWipLimit(limit)) {
        wipLimits[id] = limit;
      }
    }
  }
  return {
    ...(Object.keys(wipLimits).length > 0 && { wipLimits }),
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

function isBoardEntry(value: unknown): value is BoardEntry {
  const e = value as BoardEntry | null;
  return typeof e === "object" && e !== null && typeof e.id === "string" && typeof e.name === "string" && isBoard(e.board);
}

export function isBoardList(value: unknown): value is BoardList {
  const list = value as BoardList | null;
  return typeof list === "object" && list !== null && typeof list.currentId === "string" && Array.isArray(list.boards);
}

// Invalid and duplicate-id entries are dropped; an unknown currentId falls back to the first board.
function normalizeBoardList(list: BoardList): BoardList | null {
  const seen = new Set<string>();
  const boards: BoardEntry[] = [];
  for (const entry of list.boards) {
    if (isBoardEntry(entry) && !seen.has(entry.id)) {
      seen.add(entry.id);
      boards.push({ id: entry.id, name: entry.name, board: normalizeBoard(entry.board) });
    }
  }
  if (boards.length === 0) {
    return null;
  }
  return { boards, currentId: seen.has(list.currentId) ? list.currentId : boards[0].id };
}

// A valid v2 value wins; otherwise the legacy single board becomes "My board"; otherwise one empty board.
// Corrupt v2 data does not consult the legacy key.
export function loadBoards(storage: Storage | undefined = globalThis.localStorage): BoardList {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      return (isBoardList(parsed) && normalizeBoardList(parsed)) || initialBoardList();
    }
    const legacy = storage?.getItem(LEGACY_STORAGE_KEY);
    if (legacy) {
      const parsed: unknown = JSON.parse(legacy);
      if (isBoard(parsed)) {
        const list = initialBoardList();
        return { ...list, boards: [{ id: list.currentId, name: DEFAULT_BOARD_NAME, board: normalizeBoard(parsed) }] };
      }
    }
  } catch {
    // fall through to an empty list
  }
  return initialBoardList();
}

export function saveBoards(list: BoardList, storage: Storage | undefined = globalThis.localStorage): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Storage full or blocked (e.g. private mode): keep working in memory.
  }
}
