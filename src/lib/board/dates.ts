import { withActivity } from "./activity";
import { findCard, insightsListIds } from "./lists";
import type { ActivityOptions, Board, Card, ColumnId } from "./types";

export function isValidDueDate(date: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) {
    return false;
  }
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const parsed = new Date(year, month - 1, day);
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day;
}

// Sets, changes or (with `undefined`) clears a card's due date.
export function setDueDate(board: Board, cardId: string, date: string | undefined, opts: ActivityOptions = {}): Board {
  const found = findCard(board, cardId);
  if (!found) {
    throw new Error(`Card ${cardId} not found`);
  }
  if (date !== undefined && !isValidDueDate(date)) {
    throw new Error("Due date must be a valid YYYY-MM-DD date");
  }
  if (found.card.dueDate === date) {
    return board;
  }
  let updated: Card = { ...found.card, dueDate: date };
  if (date === undefined) {
    delete updated.dueDate;
  }
  updated = withActivity(updated, { type: "dueDate", from: found.card.dueDate, to: date }, opts);
  return {
    ...board,
    columns: {
      ...board.columns,
      [found.column]: board.columns[found.column].map((c) => (c.id === cardId ? updated : c)),
    },
  };
}

// Local calendar day as `YYYY-MM-DD`.
export function todayString(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${String(now.getFullYear()).padStart(4, "0")}-${month}-${day}`;
}

// Overdue = due before today and not in the done list (`doneId`: the board's resolved done list, `null` when there is none).
// Due today is not overdue.
export function isOverdue(card: Card, column: ColumnId, today: string, doneId: ColumnId | null): boolean {
  return column !== doneId && !!card.dueDate && card.dueDate < today;
}

// Whether a card in `column` is overdue on this board (its done list is not overdue).
export function isCardOverdue(board: Board, card: Card, column: ColumnId, today: string = todayString()): boolean {
  return isOverdue(card, column, today, insightsListIds(board).done ?? null);
}

export type DueStatus = "overdue" | "today" | "tomorrow";

// Day after `date` (`YYYY-MM-DD`), as a local calendar day.
function nextDay(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return todayString(new Date(year, month - 1, day + 1));
}

// Due status of a card in `column`: overdue, due today or due tomorrow, else null (also for the done list).
export function dueStatus(
  card: Card,
  column: ColumnId,
  today: string,
  doneId: ColumnId | null,
): DueStatus | null {
  if (!card.dueDate || column === doneId) {
    return null;
  }
  if (isOverdue(card, column, today, doneId)) {
    return "overdue";
  }
  if (card.dueDate === today) {
    return "today";
  }
  return card.dueDate === nextDay(today) ? "tomorrow" : null;
}

// Due status of a card in `column` on this board.
export function cardDueStatus(board: Board, card: Card, column: ColumnId, today: string = todayString()): DueStatus | null {
  return dueStatus(card, column, today, insightsListIds(board).done ?? null);
}

// Short readable date (e.g. "Oct 28"). Parsed as a local date so the day never shifts by timezone.
export function formatDueDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
