import { describe, expect, it } from "vitest";
import {
  addCard,
  emptyBoard,
  findCard,
  formatDueDate,
  isOverdue,
  isValidDueDate,
  moveCard,
  setDueDate,
  todayString,
} from "@/lib/board";

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
