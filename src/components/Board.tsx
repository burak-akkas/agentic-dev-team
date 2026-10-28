"use client";

import { useState } from "react";
import {
  addCard,
  COLUMNS,
  deleteCard,
  filterCards,
  isFiltering,
  moveCard,
  renameCard,
  setDueDate,
  setPriority,
} from "@/lib/board";
import { useBoard } from "@/lib/useBoard";
import { AddCardForm } from "./AddCardForm";
import { CardItem } from "./CardItem";
import { SearchBox } from "./SearchBox";

export function Board() {
  const [board, update] = useBoard();
  const [query, setQuery] = useState("");
  const visible = filterCards(board, query);
  const filtering = isFiltering(query);

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
              className="flex flex-col gap-3 rounded-xl bg-zinc-100 p-3 dark:bg-zinc-900/50"
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
