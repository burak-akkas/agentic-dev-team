import { describe, expect, it } from "vitest";
import { addCard, emptyBoard } from "./board";
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

  it("works without storage", () => {
    expect(loadBoard(undefined)).toEqual(emptyBoard());
    expect(() => saveBoard(emptyBoard(), undefined)).not.toThrow();
  });
});
