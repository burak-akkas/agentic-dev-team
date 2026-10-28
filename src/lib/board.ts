// Pure board logic. Every function returns a new board and never mutates its input.

export type ColumnId = "todo" | "doing" | "done";

export type Priority = "low" | "medium" | "high";

export interface Card {
  id: string;
  title: string;
  createdAt: string;
  priority: Priority;
}

export interface Board {
  columns: Record<ColumnId, Card[]>;
}

export const COLUMNS: readonly { id: ColumnId; title: string }[] = [
  { id: "todo", title: "To do" },
  { id: "doing", title: "Doing" },
  { id: "done", title: "Done" },
];

export const PRIORITIES: readonly { id: Priority; label: string }[] = [
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
];

export const DEFAULT_PRIORITY: Priority = "medium";

export const MAX_TITLE_LENGTH = 120;

export function emptyBoard(): Board {
  return { columns: { todo: [], doing: [], done: [] } };
}

function normalizeTitle(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) {
    throw new Error("Card title must not be empty");
  }
  if (trimmed.length > MAX_TITLE_LENGTH) {
    throw new Error(`Card title must be at most ${MAX_TITLE_LENGTH} characters`);
  }
  return trimmed;
}

export function addCard(
  board: Board,
  title: string,
  { id = crypto.randomUUID(), now = new Date() }: { id?: string; now?: Date } = {},
): Board {
  const card: Card = {
    id,
    title: normalizeTitle(title),
    createdAt: now.toISOString(),
    priority: DEFAULT_PRIORITY,
  };
  return { columns: { ...board.columns, todo: [...board.columns.todo, card] } };
}

export function setPriority(board: Board, cardId: string, priority: Priority): Board {
  const found = findCard(board, cardId);
  if (!found) {
    throw new Error(`Card ${cardId} not found`);
  }
  if (found.card.priority === priority) {
    return board;
  }
  return {
    columns: {
      ...board.columns,
      [found.column]: board.columns[found.column].map((c) => (c.id === cardId ? { ...c, priority } : c)),
    },
  };
}

export function renameCard(board: Board, cardId: string, title: string): Board {
  const found = findCard(board, cardId);
  if (!found) {
    throw new Error(`Card ${cardId} not found`);
  }
  const trimmed = normalizeTitle(title);
  if (trimmed === found.card.title) {
    return board;
  }
  return {
    columns: {
      ...board.columns,
      [found.column]: board.columns[found.column].map((c) => (c.id === cardId ? { ...c, title: trimmed } : c)),
    },
  };
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

export function isFiltering(query: string): boolean {
  return query.trim() !== "";
}

// Cards whose title contains the query (case-insensitive, trimmed). A blank query returns the same board.
export function filterCards(board: Board, query: string): Board {
  if (!isFiltering(query)) {
    return board;
  }
  const q = query.trim().toLowerCase();
  return {
    columns: {
      todo: board.columns.todo.filter((c) => c.title.toLowerCase().includes(q)),
      doing: board.columns.doing.filter((c) => c.title.toLowerCase().includes(q)),
      done: board.columns.done.filter((c) => c.title.toLowerCase().includes(q)),
    },
  };
}

// Neighbouring column, for the "move left / right" buttons.
export function adjacentColumn(column: ColumnId, direction: -1 | 1): ColumnId | undefined {
  const index = COLUMNS.findIndex((c) => c.id === column);
  return COLUMNS[index + direction]?.id;
}
