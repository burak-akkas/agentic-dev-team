"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { adjacentColumn, COLUMNS, MAX_TITLE_LENGTH, type Card, type ColumnId } from "@/lib/board";

const columnTitle = (id: ColumnId) => COLUMNS.find((c) => c.id === id)?.title ?? id;

const iconButton =
  "rounded-md px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100";

export function CardItem({
  card,
  column,
  onMove,
  onDelete,
  onRename,
}: {
  card: Card;
  column: ColumnId;
  onMove: (to: ColumnId) => void;
  onDelete: () => void;
  onRename: (title: string) => void;
}) {
  const previous = adjacentColumn(column, -1);
  const next = adjacentColumn(column, 1);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(card.title);
  const inputRef = useRef<HTMLInputElement>(null);
  const editRef = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
    } else if (restoreFocus.current) {
      restoreFocus.current = false;
      editRef.current?.focus();
    }
  }, [editing]);

  function startEditing() {
    setDraft(card.title);
    setEditing(true);
  }

  function stopEditing() {
    restoreFocus.current = true;
    setEditing(false);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.trim()) {
      return;
    }
    onRename(draft);
    stopEditing();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      stopEditing();
    }
  }

  if (editing) {
    return (
      <li className="group rounded-lg border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <input
            ref={inputRef}
            aria-label="Card title"
            value={draft}
            maxLength={MAX_TITLE_LENGTH}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            className="min-w-0 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-900"
          />
          <div className="flex items-center gap-1">
            <button
              type="submit"
              disabled={!draft.trim()}
              className="rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Save
            </button>
            <button type="button" className={iconButton} onClick={stopEditing}>
              Cancel
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="group rounded-lg border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <p className="break-words text-sm">{card.title}</p>
      <div className="mt-2 flex items-center gap-1">
        {previous && (
          <button
            type="button"
            className={iconButton}
            aria-label={`Move "${card.title}" to ${columnTitle(previous)}`}
            onClick={() => onMove(previous)}
          >
            ←
          </button>
        )}
        {next && (
          <button
            type="button"
            className={iconButton}
            aria-label={`Move "${card.title}" to ${columnTitle(next)}`}
            onClick={() => onMove(next)}
          >
            →
          </button>
        )}
        <button
          ref={editRef}
          type="button"
          className={`${iconButton} ml-auto`}
          aria-label={`Edit "${card.title}"`}
          onClick={startEditing}
        >
          Edit
        </button>
        <button
          type="button"
          className={`${iconButton} hover:text-red-600 dark:hover:text-red-400`}
          aria-label={`Delete "${card.title}"`}
          onClick={onDelete}
        >
          Delete
        </button>
      </div>
    </li>
  );
}
