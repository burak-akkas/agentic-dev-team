import { boardLists } from "./lists";
import { MAX_WIP_LIMIT } from "./types";
import type { Board, ColumnId, WipLimitResult, WipState } from "./types";

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

export function isListCollapsed(board: Board, id: ColumnId): boolean {
  return board.collapsedLists?.includes(id) ?? false;
}

// Collapses an expanded list or expands a collapsed one. Unknown ids are ignored; the key is removed once empty.
export function toggleListCollapsed(board: Board, id: ColumnId): Board {
  const { collapsedLists, ...rest } = board;
  if (collapsedLists?.includes(id)) {
    const remaining = collapsedLists.filter((c) => c !== id);
    return remaining.length === 0 ? rest : { ...rest, collapsedLists: remaining };
  }
  if (!boardLists(board).some((l) => l.id === id)) {
    return board;
  }
  return { ...rest, collapsedLists: [...(collapsedLists ?? []), id] };
}

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
