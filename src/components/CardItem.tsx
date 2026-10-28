"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from "react";
import {
  adjacentColumn,
  COLUMNS,
  formatDueDate,
  isOverdue,
  isValidDueDate,
  MAX_TITLE_LENGTH,
  PRIORITIES,
  type Card,
  type ColumnId,
  type Priority,
} from "@/lib/board";

const columnTitle = (id: ColumnId) => COLUMNS.find((c) => c.id === id)?.title ?? id;
const priorityLabel = (id: Priority) => PRIORITIES.find((p) => p.id === id)?.label ?? id;

const badgeStyles: Record<Priority, string> = {
  low: "bg-zinc-200 font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  medium: "bg-amber-100 font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  high: "bg-red-600 font-bold text-white dark:bg-red-500 dark:text-white",
};

const iconButton =
  "rounded-md px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100";

export function CardItem({
  card,
  column,
  onMove,
  onDelete,
  onRename,
  onSetDueDate,
  onSetPriority,
}: {
  card: Card;
  column: ColumnId;
  onMove: (to: ColumnId) => void;
  onDelete: () => void;
  onRename: (title: string) => void;
  onSetDueDate: (date: string | undefined) => void;
  onSetPriority: (priority: Priority) => void;
}) {
  const previous = adjacentColumn(column, -1);
  const next = adjacentColumn(column, 1);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(card.title);
  const inputRef = useRef<HTMLInputElement>(null);
  const editRef = useRef<HTMLButtonElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const restoreFocus = useRef(false);
  const overdue = isOverdue(card, column);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
    } else if (restoreFocus.current) {
      restoreFocus.current = false;
      editRef.current?.focus();
    }
  }, [editing]);

  function clearDueDate() {
    onSetDueDate(undefined);
    dateRef.current?.focus();
  }

  function handleDueDateChange(event: ChangeEvent<HTMLInputElement>) {
    const { value } = event.target;
    if (!value) {
      onSetDueDate(undefined);
    } else if (isValidDueDate(value)) {
      onSetDueDate(value);
    }
  }

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
      <div className="flex items-start justify-between gap-2">
        <p className="break-words text-sm">{card.title}</p>
        <span
          data-testid="priority-badge"
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${badgeStyles[card.priority]}`}
        >
          {priorityLabel(card.priority)}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
        <input
          ref={dateRef}
          type="date"
          aria-label={`Due date for "${card.title}"`}
          value={card.dueDate ?? ""}
          onChange={handleDueDateChange}
          className="rounded-md border border-zinc-300 bg-white px-1.5 py-0.5 text-xs outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:[color-scheme:dark]"
        />
        {card.dueDate && (
          <>
            <time dateTime={card.dueDate}>{formatDueDate(card.dueDate)}</time>
            {overdue && (
              <span className="rounded-full bg-red-50 px-2 py-0.5 font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300">
                <span aria-hidden="true">⚠ </span>Overdue
              </span>
            )}
            <button
              type="button"
              className={iconButton}
              aria-label={`Clear due date for "${card.title}"`}
              onClick={clearDueDate}
            >
              Clear
            </button>
          </>
        )}
      </div>
      <div className="mt-2 flex items-center gap-1">
        <select
          aria-label={`Priority of "${card.title}"`}
          value={card.priority}
          onChange={(event) => onSetPriority(event.target.value as Priority)}
          className="rounded-md border border-zinc-300 bg-white px-1 py-1 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
        >
          {PRIORITIES.map(({ id, label }) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
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
