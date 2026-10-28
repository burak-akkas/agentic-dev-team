import { describe, expect, it } from "vitest";
import { addCard, emptyBoard, setDueDate, setPriority } from "./board";
import { exportFilename, loadBoard, parseBoard, saveBoard, serializeBoard, STORAGE_KEY } from "./storage";

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

  it("works without storage", () => {
    expect(loadBoard(undefined)).toEqual(emptyBoard());
    expect(() => saveBoard(emptyBoard(), undefined)).not.toThrow();
  });
});

describe("export and import", () => {
  it("round-trips a board through serializeBoard and parseBoard", () => {
    const added = addCard(emptyBoard(), "Task", { id: "c1" });
    const board = setDueDate(setPriority(added, "c1", "low"), "c1", "2026-01-02");
    const result = parseBoard(serializeBoard(board));
    expect(result).toEqual({ ok: true, board });
  });

  it("defaults missing priority and leaves a missing dueDate unset", () => {
    const old = JSON.stringify({
      columns: { todo: [{ id: "a", title: "Old", createdAt: "2024-01-01T00:00:00.000Z" }], doing: [], done: [] },
    });
    const result = parseBoard(old);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.board.columns.todo[0].priority).toBe("medium");
      expect(result.board.columns.todo[0].dueDate).toBeUndefined();
    }
  });

  it.each([
    ["not json", "nope"],
    ["empty object", "{}"],
    ["array", "[]"],
    ["null", "null"],
    ["missing columns", '{"columns":{"todo":[]}}'],
    [
      "bad due date",
      '{"columns":{"todo":[{"id":"a","title":"t","createdAt":"x","dueDate":"31-12-2026"}],"doing":[],"done":[]}}',
    ],
  ])("rejects %s", (_name, text) => {
    const result = parseBoard(text);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).not.toBe("");
    }
  });

  it("names the export file after the local date", () => {
    expect(exportFilename(new Date(2026, 9, 28))).toBe("kanban-board-2026-10-28.json");
  });
});
