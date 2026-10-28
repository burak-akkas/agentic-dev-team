"use client";

import { useState } from "react";
import type { Card } from "@/lib/board";
import { Button, Surface } from "./ui";

export function ArchivePanel({
  id,
  cards,
  onRestore,
  onDelete,
  onEmpty,
}: {
  id: string;
  cards: Card[];
  onRestore: (cardId: string) => void;
  onDelete: (cardId: string) => void;
  onEmpty: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const count = cards.length;
  const noun = count === 1 ? "card" : "cards";

  return (
    <Surface id={id} aria-label="Archived cards">
      {count > 0 && !confirming && (
        <div className="mb-2 flex justify-end">
          <Button size="xs" onClick={() => setConfirming(true)} className="text-danger">
            Empty archive
          </Button>
        </div>
      )}
      {count > 0 && confirming && (
        <div role="alertdialog" aria-label="Confirm empty archive" className="mb-2 flex flex-wrap items-center justify-end gap-2 text-sm">
          <span>
            Permanently delete {count} archived {noun}?
          </span>
          <Button
            size="xs"
            className="text-danger"
            onClick={() => {
              setConfirming(false);
              onEmpty();
            }}
          >
            Delete {count} {noun}
          </Button>
          <Button size="xs" autoFocus onClick={() => setConfirming(false)}>
            Cancel
          </Button>
        </div>
      )}
      {cards.length === 0 ? (
        <p className="px-1 py-2 text-center text-xs text-muted">No archived cards</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {cards.map((card) => (
            <li
              key={card.id}
              className="flex items-center justify-between gap-3 rounded-lg bg-surface-muted px-3 py-2 text-sm"
            >
              <span className="min-w-0 break-words">{card.title}</span>
              <span className="flex shrink-0 gap-2">
                <Button size="xs" aria-label={`Restore "${card.title}"`} onClick={() => onRestore(card.id)}>
                  Restore
                </Button>
                <Button
                  size="xs"
                  aria-label={`Delete "${card.title}" permanently`}
                  onClick={() => onDelete(card.id)}
                  className="text-danger"
                >
                  Delete permanently
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Surface>
  );
}
