import { describe, expect, it } from "vitest";
import { addCard } from "./board";
import {
  createBoardEntry,
  currentEntry,
  deleteBoardEntry,
  initialBoardList,
  MAX_BOARD_NAME_LENGTH,
  renameBoard,
  resolveBoardId,
  selectBoard,
  updateCurrentBoard,
  validateBoardName,
} from "./boards";

describe("initialBoardList", () => {
  it("has one empty 'My board' that is current", () => {
    const list = initialBoardList("a");
    expect(list.currentId).toBe("a");
    expect(list.boards).toHaveLength(1);
    expect(list.boards[0].name).toBe("My board");
    expect(list.boards[0].board.columns.todo).toEqual([]);
  });
});

describe("validateBoardName", () => {
  const boards = [
    { id: "a", name: "Work" },
    { id: "b", name: "Home" },
  ];

  it("trims the name", () => {
    expect(validateBoardName("  Side  ", boards)).toEqual({ ok: true, name: "Side" });
  });

  it("rejects empty or blank names", () => {
    expect(validateBoardName("", boards).ok).toBe(false);
    expect(validateBoardName("   ", boards).ok).toBe(false);
  });

  it("accepts 40 characters and rejects 41", () => {
    expect(validateBoardName("x".repeat(MAX_BOARD_NAME_LENGTH), boards).ok).toBe(true);
    expect(validateBoardName("x".repeat(MAX_BOARD_NAME_LENGTH + 1), boards).ok).toBe(false);
  });

  it("rejects case-insensitive duplicates", () => {
    expect(validateBoardName("work", boards).ok).toBe(false);
    expect(validateBoardName(" HOME ", boards).ok).toBe(false);
  });

  it("lets a board be renamed to its own name with different casing", () => {
    expect(validateBoardName("WORK", boards, "a")).toEqual({ ok: true, name: "WORK" });
    expect(validateBoardName("home", boards, "a").ok).toBe(false);
  });
});

describe("resolveBoardId", () => {
  const list = createBoardEntry(initialBoardList("a"), "Work", "b");

  it("returns a known id", () => {
    expect(resolveBoardId(list, "a")).toBe("a");
  });

  it("falls back to the first board for an unknown id", () => {
    expect(resolveBoardId(list, "nope")).toBe("a");
  });

  it("keeps the current board without a param", () => {
    expect(resolveBoardId(list, null)).toBe("b");
  });
});

describe("board list logic", () => {
  it("creates a board, makes it current and does not mutate", () => {
    const list = initialBoardList("a");
    const next = createBoardEntry(list, " Work ", "b");
    expect(next.boards.map((b) => b.name)).toEqual(["My board", "Work"]);
    expect(next.currentId).toBe("b");
    expect(list.boards).toHaveLength(1);
    expect(list.currentId).toBe("a");
  });

  it("returns the list unchanged for an invalid or duplicate name", () => {
    const list = initialBoardList("a");
    expect(createBoardEntry(list, "  ", "b")).toBe(list);
    expect(createBoardEntry(list, "my BOARD", "b")).toBe(list);
  });

  it("renames a board", () => {
    const list = createBoardEntry(initialBoardList("a"), "Work", "b");
    const next = renameBoard(list, "a", "Home");
    expect(next.boards.map((b) => b.name)).toEqual(["Home", "Work"]);
    expect(renameBoard(list, "a", "work")).toBe(list);
    expect(renameBoard(list, "a", "MY BOARD").boards[0].name).toBe("MY BOARD");
    expect(renameBoard(list, "zzz", "Other")).toBe(list);
  });

  it("refuses to delete the last board", () => {
    const list = initialBoardList("a");
    expect(deleteBoardEntry(list, "a")).toBe(list);
  });

  it("deletes a board and moves current to the first remaining one", () => {
    const list = createBoardEntry(createBoardEntry(initialBoardList("a"), "Two", "b"), "Three", "c");
    expect(list.currentId).toBe("c");
    const next = deleteBoardEntry(list, "c");
    expect(next.boards.map((b) => b.id)).toEqual(["a", "b"]);
    expect(next.currentId).toBe("a");
    const other = deleteBoardEntry(list, "a");
    expect(other.currentId).toBe("c");
    expect(deleteBoardEntry(list, "zzz")).toBe(list);
  });

  it("selects a board and ignores unknown ids", () => {
    const list = createBoardEntry(initialBoardList("a"), "Two", "b");
    expect(selectBoard(list, "a").currentId).toBe("a");
    expect(selectBoard(list, "zzz")).toBe(list);
  });

  it("changing one board never affects another", () => {
    const list = createBoardEntry(initialBoardList("a"), "Two", "b");
    const changed = updateCurrentBoard(list, (board) => addCard(board, "Only in two", { id: "c1" }));
    expect(changed.boards[1].board.columns.todo).toHaveLength(1);
    expect(changed.boards[0].board).toBe(list.boards[0].board);
    expect(currentEntry(selectBoard(changed, "a")).board.columns.todo).toEqual([]);
  });
});
