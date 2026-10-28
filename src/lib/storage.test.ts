import { describe, expect, it } from "vitest";
import { addCard, emptyBoard, setPriority } from "./board";
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

  it("loads cards saved without a priority as Medium, keeping other data", () => {
    const legacy = { id: "a", title: "old", createdAt: "2026-01-01T00:00:00.000Z" };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ columns: { todo: [], doing: [legacy], done: [] } }));
    expect(loadBoard().columns.doing).toEqual([{ ...legacy, priority: "medium" }]);
  });

  it("falls back to Medium for invalid priorities and keeps valid ones", () => {
    const card = { id: "a", title: "t", createdAt: "x" };
    const stored = {
      columns: {
        todo: [
          { ...card, id: "1", priority: "urgent" },
          { ...card, id: "2", priority: 3 },
          { ...card, id: "3", priority: "high" },
        ],
        doing: [],
        done: [],
      },
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    expect(loadBoard().columns.todo.map((c) => c.priority)).toEqual(["medium", "medium", "high"]);
  });

  it("round-trips a high priority", () => {
    const board = setPriority(addCard(emptyBoard(), "x", { id: "a" }), "a", "high");
    saveBoard(board);
    expect(loadBoard()).toEqual(board);
  });

  it("works without storage", () => {
    expect(loadBoard(undefined)).toEqual(emptyBoard());
    expect(() => saveBoard(emptyBoard(), undefined)).not.toThrow();
  });
});
