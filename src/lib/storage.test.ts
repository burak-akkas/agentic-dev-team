import { describe, expect, it } from "vitest";
import { addCard, emptyBoard, setDueDate } from "./board";
import { loadBoard, saveBoard, STORAGE_KEY } from "./storage";

describe("storage", () => {
  it("round-trips a board through localStorage", () => {
    const board = addCard(emptyBoard(), "persist me", { id: "a" });
    saveBoard(board);
    expect(loadBoard()).toEqual(board);
  });

  it("returns an empty board when nothing is stored", () => {
    expect(loadBoard()).toEqual(emptyBoard());
  });

  it("returns an empty board for corrupt or foreign data", () => {
    localStorage.setItem(STORAGE_KEY, "{not json");
    expect(loadBoard()).toEqual(emptyBoard());

    localStorage.setItem(STORAGE_KEY, JSON.stringify({ columns: { todo: [{ id: 1 }] } }));
    expect(loadBoard()).toEqual(emptyBoard());
  });

  it("loads cards saved before due dates existed", () => {
    const old = { id: "a", title: "Old", createdAt: "2024-01-01T00:00:00.000Z" };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ columns: { todo: [old], doing: [], done: [] } }));
    expect(loadBoard().columns.todo).toEqual([old]);
  });

  it("round-trips a due date", () => {
    const board = setDueDate(addCard(emptyBoard(), "Due", { id: "a" }), "a", "2026-10-28");
    saveBoard(board);
    expect(loadBoard().columns.todo[0].dueDate).toBe("2026-10-28");
  });

  it("returns an empty board for an invalid stored due date", () => {
    for (const dueDate of [20261028, "nope", "2026-02-31", null]) {
      const card = { id: "a", title: "Bad", createdAt: "x", dueDate };
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ columns: { todo: [card], doing: [], done: [] } }));
      expect(loadBoard()).toEqual(emptyBoard());
    }
  });

  it("works without storage", () => {
    expect(loadBoard(undefined)).toEqual(emptyBoard());
    expect(() => saveBoard(emptyBoard(), undefined)).not.toThrow();
  });
});
