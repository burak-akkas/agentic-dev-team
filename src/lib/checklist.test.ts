import { describe, expect, it } from "vitest";
import {
  addCard,
  addChecklistItem,
  archiveDone,
  checklistProgress,
  deleteChecklistItem,
  editChecklistItem,
  emptyBoard,
  findCard,
  MAX_CHECKLIST_ITEM_LENGTH,
  moveCard,
  moveChecklistItem,
  restoreCard,
  toggleChecklistItem,
  updateCard,
  type Board,
} from "./board";

function withItems(texts: string[]): Board {
  let board = addCard(emptyBoard(), "Card", { id: "c" });
  texts.forEach((text, i) => {
    board = addChecklistItem(board, "c", text, { id: `i${i}` });
  });
  return board;
}

const texts = (board: Board) => findCard(board, "c")?.card.checklist?.map((i) => i.text);
const ids = (board: Board) => findCard(board, "c")?.card.checklist?.map((i) => i.id);

describe("checklist", () => {
  it("adds trimmed, unchecked items at the end with an injectable id", () => {
    const board = withItems(["one", "  two  "]);
    expect(findCard(board, "c")?.card.checklist).toEqual([
      { id: "i0", text: "one", done: false },
      { id: "i1", text: "two", done: false },
    ]);
  });

  it("generates an id by default", () => {
    const board = addChecklistItem(addCard(emptyBoard(), "Card", { id: "c" }), "c", "x");
    expect(findCard(board, "c")?.card.checklist?.[0].id).toBeTruthy();
  });

  it("rejects empty and over-long text, accepts the limit", () => {
    const board = withItems([]);
    expect(() => addChecklistItem(board, "c", "   ")).toThrow();
    expect(() => addChecklistItem(board, "c", "x".repeat(MAX_CHECKLIST_ITEM_LENGTH + 1))).toThrow();
    expect(MAX_CHECKLIST_ITEM_LENGTH).toBe(200);
    expect(texts(addChecklistItem(board, "c", "x".repeat(200)))?.[0]).toHaveLength(200);
  });

  it("toggles an item", () => {
    const board = toggleChecklistItem(withItems(["a", "b"]), "c", "i1");
    expect(findCard(board, "c")?.card.checklist?.map((i) => i.done)).toEqual([false, true]);
    const again = toggleChecklistItem(board, "c", "i1");
    expect(findCard(again, "c")?.card.checklist?.[1].done).toBe(false);
  });

  it("edits an item; same text is a no-op", () => {
    const board = withItems(["a", "b"]);
    expect(texts(editChecklistItem(board, "c", "i0", "  z "))).toEqual(["z", "b"]);
    expect(editChecklistItem(board, "c", "i0", "a ")).toBe(board);
    expect(() => editChecklistItem(board, "c", "i0", " ")).toThrow();
  });

  it("deletes an item and removes the field with the last one", () => {
    const board = withItems(["a", "b"]);
    const one = deleteChecklistItem(board, "c", "i0");
    expect(texts(one)).toEqual(["b"]);
    const none = deleteChecklistItem(one, "c", "i1");
    expect(findCard(none, "c")?.card).not.toHaveProperty("checklist");
  });

  it("moves items up and down; no-op at the ends", () => {
    const board = withItems(["a", "b", "c"]);
    expect(ids(moveChecklistItem(board, "c", "i2", -1))).toEqual(["i0", "i2", "i1"]);
    expect(ids(moveChecklistItem(board, "c", "i0", 1))).toEqual(["i1", "i0", "i2"]);
    expect(moveChecklistItem(board, "c", "i0", -1)).toBe(board);
    expect(moveChecklistItem(board, "c", "i2", 1)).toBe(board);
  });

  it("throws for an unknown card or item", () => {
    const board = withItems(["a"]);
    expect(() => addChecklistItem(board, "nope", "x")).toThrow();
    expect(() => toggleChecklistItem(board, "c", "nope")).toThrow();
    expect(() => editChecklistItem(board, "c", "nope", "x")).toThrow();
    expect(() => deleteChecklistItem(board, "c", "nope")).toThrow();
    expect(() => moveChecklistItem(board, "c", "nope", 1)).toThrow();
  });

  it("does not mutate its input", () => {
    const board = withItems(["a", "b"]);
    const snapshot = JSON.stringify(board);
    toggleChecklistItem(board, "c", "i0");
    editChecklistItem(board, "c", "i0", "z");
    moveChecklistItem(board, "c", "i0", 1);
    deleteChecklistItem(board, "c", "i0");
    addChecklistItem(board, "c", "q");
    expect(JSON.stringify(board)).toBe(snapshot);
  });

  it("reports progress, or nothing without a checklist", () => {
    const board = toggleChecklistItem(withItems(["a", "b", "c"]), "c", "i0");
    expect(checklistProgress(findCard(board, "c")!.card)).toEqual({ done: 1, total: 3 });
    expect(checklistProgress(findCard(withItems([]), "c")!.card)).toBeUndefined();
  });

  it("survives save, move, archive and restore", () => {
    let board = withItems(["a"]);
    board = updateCard(board, "c", { title: "New", notes: undefined, priority: "high", dueDate: undefined, column: "doing" });
    expect(texts(board)).toEqual(["a"]);
    board = archiveDone(moveCard(board, "c", "done"));
    board = restoreCard(board, "c");
    expect(texts(board)).toEqual(["a"]);
  });
});
