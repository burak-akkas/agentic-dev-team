import { withActivity } from "./activity";
import { boardLists, insightsListIds, listCards, requireList } from "./lists";
import type { ActivityOptions, Board, Card, ColumnId } from "./types";

// Where restored cards go: the chosen done list, else the last list.
function restoreTarget(board: Board): ColumnId {
  const lists = boardLists(board);
  return insightsListIds(board).done ?? lists[lists.length - 1].id;
}

// Moves every card of a list to the end of the archive. Returns the same board when the list is empty.
export function archiveList(board: Board, listId: ColumnId, { now = new Date() }: { now?: Date } = {}): Board {
  requireList(board, listId);
  const cards = listCards(board, listId);
  if (cards.length === 0) {
    return board;
  }
  return {
    ...board,
    columns: { ...board.columns, [listId]: [] },
    archive: [...board.archive, ...cards.map((c) => withActivity(c, { type: "archived" }, { now }))],
  };
}

// Archives the done list (see `insightsListIds`). Returns the same board when there is none or it is empty.
export function archiveDone(board: Board, opts: { now?: Date } = {}): Board {
  const done = insightsListIds(board).done;
  return done === undefined ? board : archiveList(board, done, opts);
}

// Moves an archived card to the end of `listId` (default: the done list, else the last list).
export function restoreCard(board: Board, cardId: string, opts: ActivityOptions & { listId?: ColumnId } = {}): Board {
  const card = board.archive.find((c) => c.id === cardId);
  if (!card) {
    throw new Error(`Archived card ${cardId} not found`);
  }
  const target = opts.listId !== undefined && boardLists(board).some((l) => l.id === opts.listId) ? opts.listId : restoreTarget(board);
  return {
    ...board,
    columns: { ...board.columns, [target]: [...listCards(board, target), withActivity(card, { type: "restored" }, opts)] },
    archive: board.archive.filter((c) => c.id !== cardId),
  };
}

export function deleteArchived(board: Board, cardId: string): Board {
  if (!board.archive.some((c) => c.id === cardId)) {
    throw new Error(`Archived card ${cardId} not found`);
  }
  return { ...board, archive: board.archive.filter((c) => c.id !== cardId) };
}

// Undoes `archiveList`: puts the given cards back at the start of `listId` (default: the done list, else the
// last list), in order. Cards no longer in the archive (restored or deleted meanwhile) are skipped.
// The archive's current copies are put back, so earlier activity is kept.
export function undoArchive(
  board: Board,
  cards: Card[],
  { now = new Date(), listId }: { now?: Date; listId?: ColumnId } = {},
): Board {
  const archived = new Map(board.archive.map((c) => [c.id, c]));
  const back = cards.flatMap((c) => archived.get(c.id) ?? []);
  if (back.length === 0) {
    return board;
  }
  const ids = new Set(back.map((c) => c.id));
  const target = listId !== undefined && boardLists(board).some((l) => l.id === listId) ? listId : restoreTarget(board);
  return {
    ...board,
    columns: {
      ...board.columns,
      [target]: [...back.map((c) => withActivity(c, { type: "restored" }, { now })), ...listCards(board, target)],
    },
    archive: board.archive.filter((c) => !ids.has(c.id)),
  };
}
