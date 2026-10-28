import { COLUMNS, emptyBoard, isValidDueDate, type Board, type Card } from "./board";

export const STORAGE_KEY = "kanban-board-v1";

function isCard(value: unknown): value is Card {
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

// Returns an empty board when storage is unavailable, empty or corrupt.
export function loadBoard(storage: Storage | undefined = globalThis.localStorage): Board {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) {
      return emptyBoard();
    }
    const parsed: unknown = JSON.parse(raw);
    return isBoard(parsed) ? parsed : emptyBoard();
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
