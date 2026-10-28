"use client";

import type { Card } from "@/lib/board";

const buttonClass =
  "rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium outline-none hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-zinc-700 dark:hover:bg-zinc-800";

export function ArchivePanel({
  id,
  cards,
  onRestore,
  onDelete,
}: {
  id: string;
  cards: Card[];
  onRestore: (cardId: string) => void;
  onDelete: (cardId: string) => void;
}) {
  return (
    <section
      id={id}
      aria-label="Archived cards"
      className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
    >
      {cards.length === 0 ? (
        <p className="px-1 py-2 text-center text-xs text-zinc-500">No archived cards</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {cards.map((card) => (
            <li
              key={card.id}
              className="flex items-center justify-between gap-3 rounded-lg bg-zinc-100 px-3 py-2 text-sm dark:bg-zinc-800"
            >
              <span className="min-w-0 break-words">{card.title}</span>
              <span className="flex shrink-0 gap-2">
                <button
                  type="button"
                  aria-label={`Restore "${card.title}"`}
                  onClick={() => onRestore(card.id)}
                  className={buttonClass}
                >
                  Restore
                </button>
                <button
                  type="button"
                  aria-label={`Delete "${card.title}" permanently`}
                  onClick={() => onDelete(card.id)}
                  className={`${buttonClass} text-red-600 dark:text-red-400`}
                >
                  Delete permanently
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
