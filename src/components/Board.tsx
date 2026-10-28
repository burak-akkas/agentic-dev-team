"use client";

import { useCallback, useRef, useState, type DragEvent } from "react";
import {
  addCard,
  archiveDone,
  boardStats,
  COLUMNS,
  deleteArchived,
  deleteCard,
  filterCards,
  filterOverdue,
  findCard,
  type Card,
  type ColumnId,
  isFiltering,
  moveCard,
  renameCard,
  restoreCard,
  setDueDate,
  setNotes,
  setPriority,
  undoArchive,
} from "@/lib/board";
import { useBoard } from "@/lib/useBoard";
import { AddCardForm } from "./AddCardForm";
import { ArchivePanel } from "./ArchivePanel";
import { CARD_DRAG_TYPE, CardItem } from "./CardItem";
import { SearchBox } from "./SearchBox";
import { SummaryBar } from "./SummaryBar";
import { UndoToast } from "./UndoToast";

export function Board() {
  const [board, update] = useBoard();
  const [query, setQuery] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const stats = boardStats(board);
  // The filter lapses by itself once nothing is overdue any more.
  const showOverdueOnly = overdueOnly && stats.overdue > 0;
  const visible = filterCards(showOverdueOnly ? filterOverdue(board) : board, query);
  const filtering = isFiltering(query) || showOverdueOnly;
  const [dragOver, setDragOver] = useState<ColumnId | null>(null);
  const dragSource = useRef<{ id: string; column: ColumnId } | null>(null);

  const [showArchive, setShowArchive] = useState(false);
  const [undo, setUndo] = useState<{ cards: Card[]; message: string } | null>(null);
  const dismissUndo = useCallback(() => setUndo(null), []);

  function archiveDoneCards() {
    const cards = board.columns.done;
    if (cards.length === 0) {
      return;
    }
    update(archiveDone);
    setUndo({ cards, message: `Archived ${cards.length} done ${cards.length === 1 ? "card" : "cards"}` });
  }

  function undoLastArchive() {
    if (undo) {
      const { cards } = undo;
      update((b) => undoArchive(b, cards));
    }
    setUndo(null);
  }

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
      <SummaryBar stats={stats} overdueOnly={showOverdueOnly} onToggleOverdue={() => setOverdueOnly(!showOverdueOnly)} />

      <AddCardForm onAdd={(title) => update((b) => addCard(b, title))} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1">
          <SearchBox value={query} onChange={setQuery} />
        </div>
        <button
          type="button"
          aria-expanded={showArchive}
          aria-controls="archive-panel"
          onClick={() => setShowArchive((open) => !open)}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium outline-none hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
        >
          Archived ({board.archive.length})
        </button>
      </div>

      {showArchive && (
        <ArchivePanel
          id="archive-panel"
          cards={board.archive}
          onRestore={(cardId) => update((b) => (b.archive.some((c) => c.id === cardId) ? restoreCard(b, cardId) : b))}
          onDelete={(cardId) => update((b) => (b.archive.some((c) => c.id === cardId) ? deleteArchived(b, cardId) : b))}
        />
      )}

      {undo && <UndoToast message={undo.message} onUndo={undoLastArchive} onDismiss={dismissUndo} />}

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
              <div className="flex items-center justify-between gap-2">
                <h2 id={`column-${id}`} className="flex items-center gap-2 px-1 text-sm font-semibold">
                  {title}
                  <span className="rounded-full bg-zinc-200 px-2 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                    {cards.length}
                  </span>
                </h2>
                {id === "done" && (
                  <button
                    type="button"
                    disabled={board.columns.done.length === 0}
                    onClick={archiveDoneCards}
                    className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium outline-none hover:bg-zinc-200 focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                  >
                    Archive done
                  </button>
                )}
              </div>
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
                      onSetNotes={(notes) => update((b) => setNotes(b, card.id, notes))}
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
