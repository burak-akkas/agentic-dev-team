import { describe, expect, it } from "vitest";
import { addCard, emptyBoard, setDueDate, setNotes, setPriority } from "./board";
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
    const old = { id: "a", title: "Old", createdAt: "2024-01-01T00:00:00.000Z", priority: "medium" };
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

  it("loads legacy cards without notes unchanged", () => {
    const old = { id: "a", title: "Old", createdAt: "x", priority: "low" };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ columns: { todo: [old], doing: [], done: [] } }));
    const [card] = loadBoard().columns.todo;
    expect(card).toEqual(old);
    expect("notes" in card).toBe(false);
  });

  it("round-trips notes", () => {
    const board = setNotes(addCard(emptyBoard(), "x", { id: "a" }), "a", "one\ntwo");
    saveBoard(board);
    expect(loadBoard()).toEqual(board);
  });

  it("drops invalid or blank notes but keeps the card, and trims valid ones", () => {
    const card = { id: "a", title: "t", createdAt: "x", priority: "high" };
    const stored = {
      columns: {
        todo: [
          { ...card, id: "1", notes: 42 },
          { ...card, id: "2", notes: "x".repeat(1001) },
          { ...card, id: "3", notes: "   " },
          { ...card, id: "4", notes: "  keep  " },
          { ...card, id: "5", notes: null },
        ],
        doing: [],
        done: [],
      },
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    const cards = loadBoard().columns.todo;
    expect(cards.map((c) => c.id)).toEqual(["1", "2", "3", "4", "5"]);
    expect(cards.map((c) => c.notes)).toEqual([undefined, undefined, undefined, "keep", undefined]);
    expect(cards.map((c) => "notes" in c)).toEqual([false, false, false, true, false]);
  });

  it("works without storage", () => {
    expect(loadBoard(undefined)).toEqual(emptyBoard());
    expect(() => saveBoard(emptyBoard(), undefined)).not.toThrow();
  });
});
