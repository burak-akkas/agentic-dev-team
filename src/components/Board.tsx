"use client";

import { useRef, useState, type DragEvent } from "react";
import {
  addCard,
  COLUMNS,
  deleteCard,
  filterCards,
  findCard,
  type ColumnId,
  isFiltering,
  moveCard,
  renameCard,
  setDueDate,
  setPriority,
} from "@/lib/board";
import { useBoard } from "@/lib/useBoard";
import { AddCardForm } from "./AddCardForm";
import { CARD_DRAG_TYPE, CardItem } from "./CardItem";
import { SearchBox } from "./SearchBox";

export function Board() {
  const [board, update] = useBoard();
  const [query, setQuery] = useState("");
  const visible = filterCards(board, query);
  const filtering = isFiltering(query);
  const [dragOver, setDragOver] = useState<ColumnId | null>(null);
  const dragSource = useRef<{ id: string; column: ColumnId } | null>(null);

  // Only our own cards, and only from another column, are valid drops.
  const canDrop = (event: DragEvent<HTMLElement>, column: ColumnId) =>
    Array.from(event.dataTransfer.types).includes(CARD_DRAG_TYPE) &&
    dragSource.current !== null &&
    dragSource.current.column !== column;

  function handleDragOver(event: DragEvent<HTMLElement>, column: ColumnId) {
    if (!canDrop(event, column)) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOver(column);
  }

  function handleDragLeave(event: DragEvent<HTMLElement>, column: ColumnId) {
    const next = event.relatedTarget;
    if (next instanceof Node && event.currentTarget.contains(next)) {
      return;
    }
    setDragOver((current) => (current === column ? null : current));
  }

  function handleDrop(event: DragEvent<HTMLElement>, column: ColumnId) {
    setDragOver(null);
    if (!canDrop(event, column)) {
      return;
    }
    event.preventDefault();
    dragSource.current = null; // the dragged card unmounts on move, so dragend may never fire
    const id = event.dataTransfer.getData(CARD_DRAG_TYPE);
    if (!id) {
      return;
    }
    update((b) => (findCard(b, id) ? moveCard(b, id, column) : b));
  }

  return (
    <div className="flex flex-col gap-6">
      <AddCardForm onAdd={(title) => update((b) => addCard(b, title))} />

      <SearchBox value={query} onChange={setQuery} />

      <div className="grid gap-4 md:grid-cols-3">
        {COLUMNS.map(({ id, title }) => {
          const cards = visible.columns[id];
          return (
            <section
              key={id}
              aria-labelledby={`column-${id}`}
              onDragEnter={(event) => handleDragOver(event, id)}
              onDragOver={(event) => handleDragOver(event, id)}
              onDragLeave={(event) => handleDragLeave(event, id)}
              onDrop={(event) => handleDrop(event, id)}
              className={`flex flex-col gap-3 rounded-xl p-3 ${
                dragOver === id
                  ? "bg-indigo-50 ring-2 ring-indigo-500 dark:bg-indigo-950/40"
                  : "bg-zinc-100 dark:bg-zinc-900/50"
              }`}
            >
              <h2 id={`column-${id}`} className="flex items-center justify-between px-1 text-sm font-semibold">
                {title}
                <span className="rounded-full bg-zinc-200 px-2 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                  {cards.length}
                </span>
              </h2>
              {cards.length === 0 ? (
                <p className="px-1 py-4 text-center text-xs text-zinc-500">
                  {filtering ? "No matching cards" : "No cards"}
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {cards.map((card) => (
                    <CardItem
                      key={card.id}
                      card={card}
                      column={id}
                      onMove={(to) => update((b) => moveCard(b, card.id, to))}
                      onDelete={() => update((b) => deleteCard(b, card.id))}
                      onRename={(title) => update((b) => renameCard(b, card.id, title))}
                      onSetDueDate={(date) => update((b) => setDueDate(b, card.id, date))}
                      onSetPriority={(priority) => update((b) => setPriority(b, card.id, priority))}
                      onDragStart={() => {
                        dragSource.current = { id: card.id, column: id };
                      }}
                      onDragEnd={() => {
                        dragSource.current = null;
                        setDragOver(null);
                      }}
                    />
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
