import { describe, expect, it } from "vitest";
import {
  addCard,
  addComment,
  adjacentColumn,
  archiveDone,
  boardStats,
  deleteArchived,
  deleteCard,
  deleteComment,
  editComment,
  emptyArchive,
  emptyBoard,
  filterCards,
  filterOverdue,
  findCard,
  formatDueDate,
  isFiltering,
  isOverdue,
  isValidDueDate,
  MAX_COMMENT_LENGTH,
  MAX_NOTES_LENGTH,
  MAX_TITLE_LENGTH,
  moveCard,
  renameCard,
  restoreArchive,
  restoreCard,
  setDueDate,
  setNotes,
  setPriority,
  todayString,
  hasChanges,
  updateCard,
  type Card,
  type CardEdits,
  undoArchive,
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

describe("comments", () => {
  const base = addCard(emptyBoard(), "Task", { id: "a" });
  const t1 = new Date("2026-10-28T10:00:00.000Z");
  const t2 = new Date("2026-10-28T11:00:00.000Z");
  const withOne = addComment(base, "a", "  first  ", { id: "c1", now: t1 });
  const withTwo = addComment(withOne, "a", "second", { id: "c2", now: t2 });
  const comments = (board = withTwo) => findCard(board, "a")!.card.comments;

  it("appends trimmed comments oldest first with injected id and time", () => {
    expect(comments()).toEqual([
      { id: "c1", text: "first", createdAt: t1.toISOString() },
      { id: "c2", text: "second", createdAt: t2.toISOString() },
    ]);
  });

  it("rejects blank and over-long text, accepting exactly the maximum", () => {
    expect(() => addComment(base, "a", "  \n ")).toThrow(/empty/);
    expect(() => addComment(base, "a", "x".repeat(MAX_COMMENT_LENGTH + 1))).toThrow(/at most/);
    expect(comments(addComment(base, "a", "x".repeat(MAX_COMMENT_LENGTH)))?.[0].text).toHaveLength(MAX_COMMENT_LENGTH);
  });

  it("edits text and sets editedAt", () => {
    const edited = editComment(withTwo, "a", "c1", " changed ", { now: t2 });
    expect(comments(edited)?.[0]).toEqual({ id: "c1", text: "changed", createdAt: t1.toISOString(), editedAt: t2.toISOString() });
    expect(comments(edited)?.[1]).toEqual(comments()?.[1]);
  });

  it("returns the same board when the edited text is unchanged", () => {
    expect(editComment(withTwo, "a", "c1", "first")).toBe(withTwo);
  });

  it("rejects blank or over-long edits", () => {
    expect(() => editComment(withTwo, "a", "c1", " ")).toThrow(/empty/);
    expect(() => editComment(withTwo, "a", "c1", "x".repeat(MAX_COMMENT_LENGTH + 1))).toThrow(/at most/);
  });

  it("deletes a comment and removes the key when none are left", () => {
    expect(comments(deleteComment(withTwo, "a", "c1"))?.map((c) => c.id)).toEqual(["c2"]);
    expect("comments" in findCard(deleteComment(withOne, "a", "c1"), "a")!.card).toBe(false);
  });

  it("throws for an unknown card or comment", () => {
    expect(() => addComment(base, "zzz", "x")).toThrow(/not found/);
    expect(() => editComment(withTwo, "zzz", "c1", "x")).toThrow(/not found/);
    expect(() => editComment(withTwo, "a", "zzz", "x")).toThrow(/not found/);
    expect(() => deleteComment(withTwo, "a", "zzz")).toThrow(/not found/);
    expect(() => deleteComment(base, "a", "c1")).toThrow(/not found/);
  });

  it("does not mutate its input", () => {
    const snapshot = structuredClone(withTwo);
    addComment(withTwo, "a", "x");
    editComment(withTwo, "a", "c1", "x");
    deleteComment(withTwo, "a", "c1");
    expect(withTwo).toEqual(snapshot);
  });

  it("keeps comments when moving, updating, archiving, restoring and undoing", () => {
    const edits: CardEdits = { title: "New", notes: undefined, priority: "high", dueDate: undefined, column: "done" };
    const updated = updateCard(withTwo, "a", edits);
    expect(comments(updated)).toHaveLength(2);
    expect(comments(moveCard(withTwo, "a", "doing"))).toHaveLength(2);
    const archived = archiveDone(updated);
    expect(archived.archive[0].comments).toHaveLength(2);
    expect(comments(restoreCard(archived, "a"))).toHaveLength(2);
    expect(comments(undoArchive(archived, updated.columns.done))).toHaveLength(2);
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

  it("emptyArchive removes every archived card", () => {
    const next = emptyArchive(archiveDone(seed()));
    expect(next.archive).toEqual([]);
    expect(next.columns.doing.map((c) => c.id)).toEqual(["c"]);
  });

  it("emptyArchive leaves Done cards on the board", () => {
    const board = archiveDone(seed());
    const withDone = moveCard(moveCard(board, "c", "doing"), "c", "done");
    const next = emptyArchive(withDone);
    expect(next.archive).toEqual([]);
    expect(next.columns.done.map((c) => c.id)).toEqual(["c"]);
  });

  it("restoreArchive puts emptied cards back and skips ones already present", () => {
    const archived = archiveDone(seed());
    const cards = archived.archive;
    const emptied = emptyArchive(archived);
    const restored = restoreArchive(emptied, cards);
    expect(restored.archive.map((c) => c.id)).toEqual(cards.map((c) => c.id));
    expect(restoreArchive(restored, cards)).toBe(restored);
  });

  it("emptyArchive returns the same board when the archive is empty", () => {
    const board = seed();
    expect(emptyArchive(board)).toBe(board);
  });

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
