import { emptyBoard, type Board } from "./board";

export const MAX_BOARD_NAME_LENGTH = 40;
export const DEFAULT_BOARD_NAME = "My board";

export type BoardEntry = { id: string; name: string; board: Board };
export type BoardList = { boards: BoardEntry[]; currentId: string };

export type NameResult = { ok: true; name: string } | { ok: false; error: string };

export function newBoardId(): string {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi?.randomUUID === "function") {
    return cryptoApi.randomUUID();
  }
  return `b-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function initialBoardList(id: string = newBoardId()): BoardList {
  return { boards: [{ id, name: DEFAULT_BOARD_NAME, board: emptyBoard() }], currentId: id };
}

// `ignoreId` is the board being renamed, so it may keep its own name (e.g. with different casing).
export function validateBoardName(name: string, boards: { id: string; name: string }[], ignoreId?: string): NameResult {
  const trimmed = name.trim();
  if (!trimmed) {
    return { ok: false, error: "Board name must not be empty." };
  }
  if (trimmed.length > MAX_BOARD_NAME_LENGTH) {
    return { ok: false, error: `Board name must be at most ${MAX_BOARD_NAME_LENGTH} characters.` };
  }
  const lower = trimmed.toLowerCase();
  if (boards.some((b) => b.id !== ignoreId && b.name.toLowerCase() === lower)) {
    return { ok: false, error: "A board with this name already exists." };
  }
  return { ok: true, name: trimmed };
}

// Appends an empty board and makes it current. An invalid name returns the list unchanged.
export function createBoardEntry(list: BoardList, name: string, id: string = newBoardId()): BoardList {
  const result = validateBoardName(name, list.boards);
  if (!result.ok || list.boards.some((b) => b.id === id)) {
    return list;
  }
  return { boards: [...list.boards, { id, name: result.name, board: emptyBoard() }], currentId: id };
}

export function renameBoard(list: BoardList, id: string, name: string): BoardList {
  const result = validateBoardName(name, list.boards, id);
  if (!result.ok || !list.boards.some((b) => b.id === id)) {
    return list;
  }
  return { ...list, boards: list.boards.map((b) => (b.id === id ? { ...b, name: result.name } : b)) };
}

// The last remaining board cannot be deleted. Deleting the current board selects the first remaining one.
export function deleteBoardEntry(list: BoardList, id: string): BoardList {
  if (list.boards.length <= 1 || !list.boards.some((b) => b.id === id)) {
    return list;
  }
  const boards = list.boards.filter((b) => b.id !== id);
  return { boards, currentId: list.currentId === id ? boards[0].id : list.currentId };
}

export function selectBoard(list: BoardList, id: string): BoardList {
  if (id === list.currentId || !list.boards.some((b) => b.id === id)) {
    return list;
  }
  return { ...list, currentId: id };
}

export function currentEntry(list: BoardList): BoardEntry {
  return list.boards.find((b) => b.id === list.currentId) ?? list.boards[0];
}

export function updateCurrentBoard(list: BoardList, change: (board: Board) => Board): BoardList {
  return {
    ...list,
    boards: list.boards.map((b) => (b.id === list.currentId ? { ...b, board: change(b.board) } : b)),
  };
}
