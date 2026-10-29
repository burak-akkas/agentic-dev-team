import { describe, expect, it } from "vitest";
import {
  addCard,
  archiveDone,
  deleteArchived,
  emptyBoard,
  filterCards,
  findCard,
  moveCard,
  restoreCard,
  undoArchive,
} from "@/lib/board";

const ids = (cards: { id: string }[]) => cards.map((c) => c.id);

describe("archive", () => {
  const seed = () => {
    let board = emptyBoard();
    for (const id of ["a", "b", "c", "d"]) {
      board = addCard(board, `Card ${id}`, { id });
    }
    board = moveCard(board, "a", "done");
    board = moveCard(board, "b", "done");
    return moveCard(board, "c", "doing");
  };

  it("archiveDone moves only Done cards, in order, and leaves other columns alone", () => {
    const next = archiveDone(seed());
    expect(ids(next.columns.done)).toEqual([]);
    expect(ids(next.archive)).toEqual(["a", "b"]);
    expect(ids(next.columns.todo)).toEqual(["d"]);
    expect(ids(next.columns.doing)).toEqual(["c"]);
  });

  it("archiveDone appends to the archive, does not mutate and is a no-op on empty Done", () => {
    const board = seed();
    const once = archiveDone(board);
    expect(ids(board.columns.done)).toEqual(["a", "b"]);
    expect(archiveDone(once)).toBe(once);
    const twice = archiveDone(moveCard(once, "d", "done"));
    expect(ids(twice.archive)).toEqual(["a", "b", "d"]);
  });

  it("restoreCard moves an archived card to the end of Done", () => {
    const next = restoreCard(moveCard(archiveDone(seed()), "d", "done"), "a");
    expect(ids(next.columns.done)).toEqual(["d", "a"]);
    expect(ids(next.archive)).toEqual(["b"]);
  });

  it("deleteArchived removes a card for good", () => {
    const next = deleteArchived(archiveDone(seed()), "a");
    expect(ids(next.archive)).toEqual(["b"]);
    expect(findCard(next, "a")).toBeUndefined();
  });

  it("restoreCard and deleteArchived throw for unknown ids", () => {
    expect(() => restoreCard(seed(), "a")).toThrow();
    expect(() => deleteArchived(seed(), "zzz")).toThrow();
  });

  it("undoArchive restores the original order and empties the archive", () => {
    const board = seed();
    const next = undoArchive(archiveDone(board), board.columns.done);
    expect(ids(next.columns.done)).toEqual(ids(board.columns.done));
    expect(next.archive).toEqual([]);
    expect(next.columns.todo).toEqual(board.columns.todo);
    expect(next.columns.doing).toEqual(board.columns.doing);
  });

  it("undoArchive skips cards already restored or deleted", () => {
    const board = seed();
    let next = archiveDone(board);
    next = restoreCard(next, "a");
    next = deleteArchived(next, "b");
    expect(undoArchive(next, board.columns.done)).toBe(next);
  });

  it("other functions and filtering carry the archive along", () => {
    const board = archiveDone(seed());
    expect(addCard(board, "x", { id: "x" }).archive).toEqual(board.archive);
    expect(moveCard(board, "c", "done").archive).toEqual(board.archive);
    expect(filterCards(board, "zzz").archive).toEqual(board.archive);
  });
});
