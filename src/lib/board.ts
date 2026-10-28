// Pure board logic. Every function returns a new board and never mutates its input.

export type ColumnId = "todo" | "doing" | "done";

export interface Card {
  id: string;
  title: string;
  createdAt: string;
}

export interface Board {
  columns: Record<ColumnId, Card[]>;
}

export const COLUMNS: readonly { id: ColumnId; title: string }[] = [
  { id: "todo", title: "To do" },
  { id: "doing", title: "Doing" },
  { id: "done", title: "Done" },
];

export const MAX_TITLE_LENGTH = 120;

export function emptyBoard(): Board {
  return { columns: { todo: [], doing: [], done: [] } };
}

export function addCard(
  board: Board,
  title: string,
  { id = crypto.randomUUID(), now = new Date() }: { id?: string; now?: Date } = {},
): Board {
  const trimmed = title.trim();
  if (!trimmed) {
    throw new Error("Card title must not be empty");
  }
  if (trimmed.length > MAX_TITLE_LENGTH) {
    throw new Error(`Card title must be at most ${MAX_TITLE_LENGTH} characters`);
  }
  const card: Card = { id, title: trimmed, createdAt: now.toISOString() };
  return { columns: { ...board.columns, todo: [...board.columns.todo, card] } };
}

export function findCard(board: Board, cardId: string): { card: Card; column: ColumnId } | undefined {
  for (const { id: column } of COLUMNS) {
    const card = board.columns[column].find((c) => c.id === cardId);
    if (card) {
      return { card, column };
    }
  }
  return undefined;
}

export function moveCard(board: Board, cardId: string, to: ColumnId): Board {
  const found = findCard(board, cardId);
  if (!found) {
    throw new Error(`Card ${cardId} not found`);
  }
  if (found.column === to) {
    return board;
  }
  return {
    columns: {
      ...board.columns,
      [found.column]: board.columns[found.column].filter((c) => c.id !== cardId),
      [to]: [...board.columns[to], found.card],
    },
  };
}

export function deleteCard(board: Board, cardId: string): Board {
  const found = findCard(board, cardId);
  if (!found) {
    throw new Error(`Card ${cardId} not found`);
  }
  return {
    columns: {
      ...board.columns,
      [found.column]: board.columns[found.column].filter((c) => c.id !== cardId),
    },
  };
}

// Neighbouring column, for the "move left / right" buttons.
export function adjacentColumn(column: ColumnId, direction: -1 | 1): ColumnId | undefined {
  const index = COLUMNS.findIndex((c) => c.id === column);
  return COLUMNS[index + direction]?.id;
}
