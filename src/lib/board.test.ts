import { describe, expect, it } from "vitest";
import {
  addCard,
  adjacentColumn,
  boardStats,
  deleteCard,
  emptyBoard,
  filterCards,
  filterOverdue,
  findCard,
  formatDueDate,
  isFiltering,
  isOverdue,
  isValidDueDate,
  MAX_NOTES_LENGTH,
  MAX_TITLE_LENGTH,
  moveCard,
  renameCard,
  setDueDate,
  setNotes,
  setPriority,
  todayString,
} from "./board";

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
    expect(result.columns.todo[0]).toEqual({
      id: "a",
      title: "renamed",
      createdAt: "2026-01-01T00:00:00.000Z",
      priority: "medium",
    });
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

describe("due dates", () => {
  const base = addCard(emptyBoard(), "Task", { id: "a" });
  const withDate = setDueDate(base, "a", "2026-10-28");
  const card = () => findCard(withDate, "a")!.card;

  it("sets, changes and clears a due date", () => {
    expect(card().dueDate).toBe("2026-10-28");
    const changed = setDueDate(withDate, "a", "2026-11-01");
    expect(findCard(changed, "a")!.card.dueDate).toBe("2026-11-01");
    const cleared = setDueDate(changed, "a", undefined);
    expect("dueDate" in findCard(cleared, "a")!.card).toBe(false);
  });

  it("does not mutate its input", () => {
    const snapshot = structuredClone(base);
    setDueDate(base, "a", "2026-10-28");
    expect(base).toEqual(snapshot);
  });

  it("returns the same board when nothing changes", () => {
    expect(setDueDate(withDate, "a", "2026-10-28")).toBe(withDate);
    expect(setDueDate(base, "a", undefined)).toBe(base);
  });

  it("throws for an unknown card or an invalid date", () => {
    expect(() => setDueDate(base, "zzz", "2026-10-28")).toThrow(/not found/);
    for (const bad of ["2026-13-01", "2026-02-31", "abc", "", "2026-1-1"]) {
      expect(() => setDueDate(base, "a", bad)).toThrow(/valid/);
    }
  });

  it("validates dates", () => {
    expect(isValidDueDate("2024-02-29")).toBe(true);
    expect(isValidDueDate("2026-02-29")).toBe(false);
  });

  it("formats today's local date", () => {
    expect(todayString(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });

  it("flags overdue cards with an injectable today", () => {
    expect(isOverdue(card(), "todo", "2026-10-29")).toBe(true);
    expect(isOverdue(card(), "doing", "2026-10-29")).toBe(true);
    expect(isOverdue(card(), "todo", "2026-10-28")).toBe(false);
    expect(isOverdue(card(), "todo", "2026-10-27")).toBe(false);
    expect(isOverdue(base.columns.todo[0], "todo", "2030-01-01")).toBe(false);
    expect(isOverdue(card(), "done", "2026-10-29")).toBe(false);
  });

  it("keeps the due date when moving into and out of Done", () => {
    const done = moveCard(withDate, "a", "done");
    expect(findCard(done, "a")!.card.dueDate).toBe("2026-10-28");
    expect(isOverdue(findCard(done, "a")!.card, "done", "2030-01-01")).toBe(false);
    const back = moveCard(done, "a", "doing");
    expect(isOverdue(findCard(back, "a")!.card, "doing", "2030-01-01")).toBe(true);
  });

  it("formats the date without a timezone shift", () => {
    expect(formatDueDate("2026-10-28")).toMatch(/28/);
    expect(formatDueDate("2026-01-01")).toMatch(/1/);
  });
});

describe("notes", () => {
  const base = addCard(emptyBoard(), "Task", { id: "a" });
  const withNotes = setNotes(base, "a", "  line one\nline two  ");
  const card = (board = withNotes) => findCard(board, "a")!.card;

  it("sets trimmed notes, edits them and clears them by removing the key", () => {
    expect(card().notes).toBe("line one\nline two");
    expect(card(setNotes(withNotes, "a", "changed")).notes).toBe("changed");
    expect("notes" in card(setNotes(withNotes, "a", undefined))).toBe(false);
  });

  it("treats blank notes as clearing", () => {
    expect("notes" in card(setNotes(withNotes, "a", " \n  "))).toBe(false);
    expect(setNotes(base, "a", "   ")).toBe(base);
  });

  it("accepts exactly the maximum length and rejects more", () => {
    expect(card(setNotes(base, "a", "x".repeat(MAX_NOTES_LENGTH))).notes).toHaveLength(MAX_NOTES_LENGTH);
    expect(() => setNotes(base, "a", "x".repeat(MAX_NOTES_LENGTH + 1))).toThrow(/at most/);
  });

  it("returns the same board when nothing changes", () => {
    expect(setNotes(withNotes, "a", "line one\nline two")).toBe(withNotes);
    expect(setNotes(base, "a", undefined)).toBe(base);
  });

  it("throws for an unknown card", () => {
    expect(() => setNotes(base, "zzz", "x")).toThrow(/not found/);
  });

  it("does not mutate its input", () => {
    const snapshot = structuredClone(base);
    setNotes(base, "a", "x");
    expect(base).toEqual(snapshot);
  });

  it("keeps notes when moving or renaming", () => {
    expect(card(moveCard(withNotes, "a", "doing")).notes).toBe("line one\nline two");
    expect(card(renameCard(withNotes, "a", "New")).notes).toBe("line one\nline two");
  });
});

describe("boardStats / filterOverdue", () => {
  const TODAY = "2026-10-28";
  let board = emptyBoard();
  for (const id of ["a", "b", "c", "d"]) {
    board = addCard(board, `Card ${id}`, { id });
  }
  board = setDueDate(board, "a", "2026-10-01"); // overdue
  board = setDueDate(board, "b", "2026-10-28"); // due today: not overdue
  board = setDueDate(board, "c", "2026-09-01");
  board = setPriority(board, "a", "high");
  board = setPriority(board, "c", "high");
  board = moveCard(board, "c", "doing"); // overdue and high
  board = moveCard(board, "d", "done");
  board = setDueDate(board, "d", "2000-01-01"); // overdue but done
  board = setPriority(board, "d", "high"); // high but done

  it("counts totals, progress, overdue and open high priority cards", () => {
    expect(boardStats(board, TODAY)).toEqual({ total: 4, done: 1, percentDone: 25, overdue: 2, highOpen: 2 });
  });

  it("handles an empty board", () => {
    expect(boardStats(emptyBoard(), TODAY)).toEqual({ total: 0, done: 0, percentDone: 0, overdue: 0, highOpen: 0 });
  });

  it("rounds the percentage", () => {
    let b = addCard(addCard(addCard(emptyBoard(), "x", { id: "x" }), "y", { id: "y" }), "z", { id: "z" });
    b = moveCard(b, "x", "done");
    expect(boardStats(b, TODAY).percentDone).toBe(33);
  });

  it("keeps only overdue, not-done cards and does not mutate", () => {
    const filtered = filterOverdue(board, TODAY);
    expect(ids(filtered.columns.todo)).toEqual(["a"]);
    expect(ids(filtered.columns.doing)).toEqual(["c"]);
    expect(filtered.columns.done).toEqual([]);
    expect(ids(board.columns.done)).toEqual(["d"]);
  });
});
