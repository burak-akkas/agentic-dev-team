import { describe, expect, it } from "vitest";
import { addCard, adjacentColumn, deleteCard, emptyBoard, filterCards, findCard, isFiltering, MAX_TITLE_LENGTH, moveCard, renameCard } from "./board";

const ids = (cards: { id: string }[]) => cards.map((c) => c.id);

describe("addCard", () => {
  it("adds a trimmed card to the end of To do", () => {
    let board = addCard(emptyBoard(), "  first  ", { id: "a", now: new Date("2026-01-01T00:00:00Z") });
    board = addCard(board, "second", { id: "b" });

    expect(ids(board.columns.todo)).toEqual(["a", "b"]);
    expect(board.columns.todo[0]).toEqual({ id: "a", title: "first", createdAt: "2026-01-01T00:00:00.000Z" });
  });

  it("rejects empty and too long titles", () => {
    expect(() => addCard(emptyBoard(), "   ")).toThrow(/must not be empty/);
    expect(() => addCard(emptyBoard(), "x".repeat(MAX_TITLE_LENGTH + 1))).toThrow(/at most/);
  });

  it("does not mutate the input board", () => {
    const board = emptyBoard();
    addCard(board, "x", { id: "a" });
    expect(board.columns.todo).toEqual([]);
  });
});

describe("moveCard", () => {
  const board = addCard(addCard(emptyBoard(), "a", { id: "a" }), "b", { id: "b" });

  it("moves a card to the end of the target column", () => {
    const moved = moveCard(moveCard(board, "a", "doing"), "b", "doing");
    expect(ids(moved.columns.todo)).toEqual([]);
    expect(ids(moved.columns.doing)).toEqual(["a", "b"]);
  });

  it("returns the same board when the card is already in the target column", () => {
    expect(moveCard(board, "a", "todo")).toBe(board);
  });

  it("does not mutate the input board", () => {
    moveCard(board, "a", "done");
    expect(ids(board.columns.todo)).toEqual(["a", "b"]);
  });

  it("throws for unknown cards", () => {
    expect(() => moveCard(board, "nope", "done")).toThrow(/not found/);
  });
});

describe("deleteCard", () => {
  it("removes only the given card", () => {
    const board = moveCard(addCard(addCard(emptyBoard(), "a", { id: "a" }), "b", { id: "b" }), "b", "done");
    const result = deleteCard(board, "b");
    expect(ids(result.columns.todo)).toEqual(["a"]);
    expect(result.columns.done).toEqual([]);
  });

  it("throws for unknown cards", () => {
    expect(() => deleteCard(emptyBoard(), "nope")).toThrow(/not found/);
  });
});

describe("renameCard", () => {
  const base = moveCard(
    addCard(
      addCard(addCard(emptyBoard(), "a", { id: "a", now: new Date("2026-01-01T00:00:00Z") }), "b", { id: "b" }),
      "c",
      { id: "c" },
    ),
    "c",
    "doing",
  );

  it("trims the title and keeps column, index, id and createdAt", () => {
    const result = renameCard(base, "a", "  renamed  ");
    expect(result.columns.todo[0]).toEqual({ id: "a", title: "renamed", createdAt: "2026-01-01T00:00:00.000Z" });
    expect(ids(result.columns.todo)).toEqual(["a", "b"]);
    expect(ids(result.columns.doing)).toEqual(["c"]);
  });

  it("renames a card in a later column", () => {
    expect(renameCard(base, "c", "z").columns.doing[0].title).toBe("z");
  });

  it("rejects empty, whitespace-only and too long titles", () => {
    expect(() => renameCard(base, "a", "")).toThrow(/must not be empty/);
    expect(() => renameCard(base, "a", "   ")).toThrow(/must not be empty/);
    expect(() => renameCard(base, "a", "x".repeat(MAX_TITLE_LENGTH + 1))).toThrow(/at most/);
  });

  it("allows a title of exactly the maximum length", () => {
    const title = "x".repeat(MAX_TITLE_LENGTH);
    expect(renameCard(base, "a", title).columns.todo[0].title).toBe(title);
  });

  it("throws for unknown cards", () => {
    expect(() => renameCard(base, "nope", "x")).toThrow(/not found/);
  });

  it("returns the same board when the title is unchanged", () => {
    expect(renameCard(base, "a", " a ")).toBe(base);
  });

  it("does not mutate the input board", () => {
    renameCard(base, "a", "changed");
    expect(base.columns.todo[0].title).toBe("a");
  });
});

describe("helpers", () => {
  it("findCard reports the column", () => {
    const board = moveCard(addCard(emptyBoard(), "a", { id: "a" }), "a", "doing");
    expect(findCard(board, "a")?.column).toBe("doing");
    expect(findCard(board, "nope")).toBeUndefined();
  });

  it("adjacentColumn walks the column order", () => {
    expect(adjacentColumn("todo", -1)).toBeUndefined();
    expect(adjacentColumn("todo", 1)).toBe("doing");
    expect(adjacentColumn("done", 1)).toBeUndefined();
  });
});

describe("filterCards / isFiltering", () => {
  let board = addCard(emptyBoard(), "Write Docs", { id: "a" });
  board = addCard(board, "Fix bug", { id: "b" });
  board = addCard(board, "Docs review", { id: "c" });
  board = moveCard(board, "c", "doing");
  board = moveCard(board, "b", "done");

  it("matches case-insensitively across all columns, preserving order", () => {
    const result = filterCards(board, "DOCS");
    expect(ids(result.columns.todo)).toEqual(["a"]);
    expect(ids(result.columns.doing)).toEqual(["c"]);
    expect(ids(result.columns.done)).toEqual([]);
  });

  it("ignores leading and trailing spaces in the query", () => {
    expect(filterCards(board, "  fix bug ").columns.done).toEqual(board.columns.done);
  });

  it("returns all cards for an empty or whitespace query", () => {
    expect(filterCards(board, "")).toBe(board);
    expect(filterCards(board, "   ")).toBe(board);
    expect(isFiltering("")).toBe(false);
    expect(isFiltering("  ")).toBe(false);
    expect(isFiltering(" a ")).toBe(true);
  });

  it("returns empty columns when nothing matches", () => {
    expect(filterCards(board, "zzz").columns).toEqual({ todo: [], doing: [], done: [] });
  });

  it("does not mutate the input board", () => {
    const snapshot = structuredClone(board);
    filterCards(board, "docs");
    expect(board).toEqual(snapshot);
  });
});
