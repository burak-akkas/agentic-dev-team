import { describe, expect, it } from "vitest";
import { addCard, adjacentColumn, deleteCard, emptyBoard, findCard, MAX_TITLE_LENGTH, moveCard } from "./board";

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
