import { describe, expect, it } from "vitest";
import {
  addCard,
  deleteCard,
  emptyBoard,
  filterCards,
  findCard,
  hasChanges,
  MAX_NOTES_LENGTH,
  MAX_TITLE_LENGTH,
  moveCard,
  renameCard,
  setPriority,
  updateCard,
  type Card,
  type CardEdits,
} from "@/lib/board";

const ids = (cards: { id: string }[]) => cards.map((c) => c.id);

describe("addCard", () => {
  it("adds a trimmed card to the end of To do", () => {
    let board = addCard(emptyBoard(), "  first  ", { id: "a", now: new Date("2026-01-01T00:00:00Z") });
    board = addCard(board, "second", { id: "b" });

    expect(ids(board.columns.todo)).toEqual(["a", "b"]);
    expect(board.columns.todo[0]).toEqual({
      id: "a",
      title: "first",
      createdAt: "2026-01-01T00:00:00.000Z",
      priority: "medium",
      activity: [{ id: expect.any(String), at: "2026-01-01T00:00:00.000Z", type: "created" }],
    });
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
    const { activity, ...card } = result.columns.todo[0];
    expect(card).toEqual({
      id: "a",
      title: "renamed",
      createdAt: "2026-01-01T00:00:00.000Z",
      priority: "medium",
    });
    expect(activity?.map((e) => e.type)).toEqual(["title", "created"]);
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

describe("setPriority", () => {
  const base = moveCard(addCard(addCard(emptyBoard(), "a", { id: "a" }), "b", { id: "b" }), "b", "doing");

  it("changes only the given card, keeping column and order", () => {
    const result = setPriority(base, "b", "high");
    expect(result.columns.doing[0].priority).toBe("high");
    expect(result.columns.todo[0].priority).toBe("medium");
    expect(ids(result.columns.todo)).toEqual(["a"]);
    expect(ids(result.columns.doing)).toEqual(["b"]);
  });

  it("returns the same board when the priority is unchanged", () => {
    expect(setPriority(base, "a", "medium")).toBe(base);
  });

  it("does not mutate the input board", () => {
    setPriority(base, "a", "low");
    expect(base.columns.todo[0].priority).toBe("medium");
  });

  it("throws for unknown cards", () => {
    expect(() => setPriority(base, "nope", "high")).toThrow(/not found/);
  });

  it("is kept by rename, move and filter", () => {
    let board = setPriority(base, "a", "high");
    board = renameCard(board, "a", "renamed");
    board = moveCard(board, "a", "done");
    expect(board.columns.done[0].priority).toBe("high");
    expect(filterCards(board, "renamed").columns.done[0].priority).toBe("high");
  });
});

describe("updateCard / hasChanges", () => {
  const base = addCard(emptyBoard(), "Task", { id: "a" });
  const original = findCard(base, "a")?.card as Card;
  const same: CardEdits = { title: "Task", notes: undefined, priority: "medium", dueDate: undefined, column: "todo" };

  it("applies all edits at once", () => {
    const next = updateCard(base, "a", {
      title: "  Renamed ",
      notes: "Some notes",
      priority: "high",
      dueDate: "2030-01-02",
      column: "doing",
    });
    expect(next.columns.todo).toEqual([]);
    const { activity, ...card } = next.columns.doing[0];
    const rest = { ...original };
    delete rest.activity;
    expect(next.columns.doing).toHaveLength(1);
    expect(card).toEqual({ ...rest, title: "Renamed", notes: "Some notes", priority: "high", dueDate: "2030-01-02" });
    expect(activity?.map((e) => e.type)).toEqual(["moved", "dueDate", "priority", "description", "title", "created"]);
  });

  it("clears notes and due date", () => {
    const full = updateCard(base, "a", { ...same, notes: "n", dueDate: "2030-01-02" });
    const cleared = updateCard(full, "a", same);
    const { activity, ...card } = findCard(cleared, "a")?.card as Card;
    const rest = { ...original };
    delete rest.activity;
    expect(card).toEqual(rest);
    expect(activity).toHaveLength(5);
  });

  it("returns the same board when nothing changed", () => {
    expect(updateCard(base, "a", same)).toBe(base);
  });

  it("throws on invalid input and leaves the input board untouched", () => {
    const snapshot = JSON.stringify(base);
    expect(() => updateCard(base, "a", { ...same, title: "  ", priority: "high" })).toThrow();
    expect(() => updateCard(base, "a", { ...same, title: "x".repeat(MAX_TITLE_LENGTH + 1) })).toThrow();
    expect(() => updateCard(base, "a", { ...same, notes: "x".repeat(MAX_NOTES_LENGTH + 1) })).toThrow();
    expect(() => updateCard(base, "a", { ...same, dueDate: "2030-13-40" })).toThrow();
    expect(JSON.stringify(base)).toBe(snapshot);
  });

  it("throws for an unknown card", () => {
    expect(() => updateCard(base, "nope", same)).toThrow();
  });

  it("detects changes per field and ignores whitespace-only differences", () => {
    expect(hasChanges(original, "todo", same)).toBe(false);
    expect(hasChanges(original, "todo", { ...same, title: " Task " })).toBe(false);
    expect(hasChanges(original, "todo", { ...same, notes: "  " })).toBe(false);
    expect(hasChanges(original, "todo", { ...same, title: "Other" })).toBe(true);
    expect(hasChanges(original, "todo", { ...same, notes: "n" })).toBe(true);
    expect(hasChanges(original, "todo", { ...same, priority: "low" })).toBe(true);
    expect(hasChanges(original, "todo", { ...same, dueDate: "2030-01-02" })).toBe(true);
    expect(hasChanges(original, "todo", { ...same, column: "done" })).toBe(true);
  });
});
