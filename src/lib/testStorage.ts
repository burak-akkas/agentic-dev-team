// Test-only helpers: seed and read the current board through the multi-board storage shape.
import type { Board } from "./board";
import { currentEntry, updateCurrentBoard } from "./boards";
import { loadBoards, saveBoards } from "./storage";

export function saveBoard(board: Board, storage: Storage | undefined = globalThis.localStorage): void {
  saveBoards(updateCurrentBoard(loadBoards(storage), () => board), storage);
}

export function loadBoard(storage: Storage | undefined = globalThis.localStorage): Board {
  return currentEntry(loadBoards(storage)).board;
}
