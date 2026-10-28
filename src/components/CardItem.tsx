"use client";

import { useEffect, useId, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent, type KeyboardEvent } from "react";
import {
  adjacentColumn,
  checklistProgress,
  COLUMNS,
  COVER_COLORS,
  formatDueDate,
  isOverdue,
  isValidDueDate,
  MAX_NOTES_LENGTH,
  MAX_TITLE_LENGTH,
  PRIORITIES,
  type Card,
  type ColumnId,
  type CoverColor,
  type Priority,
} from "@/lib/board";
import { coverStyles } from "./coverColors";
import { LabelChip } from "./LabelChip";
import { Button, Input, Select, Textarea } from "./ui";

export const CARD_DRAG_TYPE = "application/x-kanban-card";

const columnTitle =(id: ColumnId) => COLUMNS.find((c) => c.id === id)?.title ?? id;
const priorityLabel = (id: Priority) => PRIORITIES.find((p) => p.id === id)?.label ?? id;

const coverLabel = (id: CoverColor) => COVER_COLORS.find((c) => c.id === id)?.label ?? id;

const badgeStyles: Record<Priority, string> = {
  low: "bg-zinc-200 font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  medium: "bg-amber-100 font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  high: "bg-red-600 font-bold text-white dark:bg-red-500 dark:text-white",
};

const cardSurface = "group rounded-lg border border-line bg-surface p-3 shadow-sm";

export function CardItem({
  card,
  column,
  onMove,
  onDelete,
  onRename,
  onSetDueDate,
  onSetNotes,
  onSetPriority,
  onOpen,
  onFilterLabel,
  onDragStart,
  onDragEnd,
}: {
  card: Card;
  column: ColumnId;
  onMove: (to: ColumnId) => void;
  onDelete: () => void;
  onRename: (title: string) => void;
  onSetDueDate: (date: string | undefined) => void;
  onSetNotes: (notes: string | undefined) => void;
  onSetPriority: (priority: Priority) => void;
  onOpen: () => void;
  onFilterLabel?: (label: string) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
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
  const progress = checklistProgress(card);
  const commentCount = card.comments?.length ?? 0;
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState(card.notes ?? "");
  const [expanded, setExpanded] = useState(false);
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const notesButtonRef = useRef<HTMLButtonElement>(null);
  const restoreNotesFocus = useRef(false);
  const notesId = useId();
  const coverId = useId();

  useEffect(() => {
    if (editingNotes) {
      notesRef.current?.focus();
    } else if (restoreNotesFocus.current) {
      restoreNotesFocus.current = false;
      notesButtonRef.current?.focus();
    }
  }, [editingNotes]);

  function startEditingNotes() {
    setNotesDraft(card.notes ?? "");
    setEditingNotes(true);
  }

  function stopEditingNotes() {
    restoreNotesFocus.current = true;
    setEditingNotes(false);
  }

  function handleNotesSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSetNotes(notesDraft.trim() || undefined);
    stopEditingNotes();
  }

  function removeNotes() {
    onSetNotes(undefined);
    stopEditingNotes();
  }

  function handleNotesKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      stopEditingNotes();
    }
  }

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

  function handleDragStart(event: DragEvent<HTMLLIElement>) {
    event.dataTransfer.setData(CARD_DRAG_TYPE, card.id);
    event.dataTransfer.effectAllowed = "move";
    onDragStart?.();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      stopEditing();
    }
  }

  if (editing) {
    return (
      <li className={cardSurface}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <Input
            ref={inputRef}
            aria-label="Card title"
            value={draft}
            maxLength={MAX_TITLE_LENGTH}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            className="min-w-0"
          />
          <div className="flex items-center gap-1">
            <Button type="submit" variant="primary" size="xs" disabled={!draft.trim()}>
              Save
            </Button>
            <Button variant="ghost" size="xs" onClick={stopEditing}>
              Cancel
            </Button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li
      data-card-id={card.id}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
      aria-describedby={card.cover ? coverId : undefined}
      className={`${cardSurface} cursor-grab active:cursor-grabbing${card.cover ? " relative overflow-hidden" : ""}`}
    >
      {card.cover && (
        <>
          <span
            aria-hidden="true"
            data-testid="cover-stripe"
            data-cover={card.cover}
            className={`absolute inset-x-0 top-0 h-1.5 ${coverStyles[card.cover]}`}
          />
          <span id={coverId} className="sr-only">
            Cover color: {coverLabel(card.cover)}
          </span>
        </>
      )}
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={onOpen}
          className="card-title min-w-0 break-words rounded text-left text-sm hover:underline"
        >
          {card.title}
        </button>
        <span
          data-testid="priority-badge"
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${badgeStyles[card.priority]}`}
        >
          {priorityLabel(card.priority)}
        </span>
      </div>
      {card.labels && card.labels.length > 0 && (
        <ul aria-label="Labels" className="mt-2 flex flex-wrap gap-1">
          {card.labels.map((label) => (
            <li key={label.toLowerCase()} className="max-w-full">
              <LabelChip label={label} onClick={() => onFilterLabel?.(label)} />
            </li>
          ))}
        </ul>
      )}
      {progress && (
        <p className="mt-2">
          <span
            role="img"
            aria-label={`${progress.done} of ${progress.total} checklist items done`}
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              progress.done === progress.total
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "bg-zinc-100 text-muted dark:bg-zinc-800"
            }`}
          >
            <span aria-hidden="true">
              ☑ {progress.done}/{progress.total}
            </span>
          </span>
        </p>
      )}
      {commentCount > 0 && (
        <div className="mt-2 flex items-center gap-1 text-xs">
          <span
            aria-label={`${commentCount} ${commentCount === 1 ? "comment" : "comments"}`}
            className="rounded-full bg-zinc-100 px-2 py-0.5 font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
          >
            <span aria-hidden="true">💬 {commentCount}</span>
          </span>
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
        <Input
          ref={dateRef}
          type="date"
          fieldSize="sm"
          aria-label={`Due date for "${card.title}"`}
          value={card.dueDate ?? ""}
          onChange={handleDueDateChange}
        />
        {card.dueDate && (
          <>
            <time dateTime={card.dueDate}>{formatDueDate(card.dueDate)}</time>
            {overdue && (
              <span className="rounded-full bg-red-50 px-2 py-0.5 font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300">
                <span aria-hidden="true">⚠ </span>Overdue
              </span>
            )}
            <Button
              variant="ghost"
              size="xs"
              aria-label={`Clear due date for "${card.title}"`}
              onClick={clearDueDate}
            >
              Clear
            </Button>
          </>
        )}
      </div>
      {editingNotes ? (
        <form onSubmit={handleNotesSubmit} className="mt-2 flex flex-col gap-2">
          <Textarea
            ref={notesRef}
            aria-label={`Notes for "${card.title}"`}
            value={notesDraft}
            maxLength={MAX_NOTES_LENGTH}
            rows={4}
            onChange={(event) => setNotesDraft(event.target.value)}
            onKeyDown={handleNotesKeyDown}
            className="min-w-0"
          />
          <div className="flex items-center gap-1">
            <Button type="submit" variant="primary" size="xs">
              Save notes
            </Button>
            <Button variant="ghost" size="xs" onClick={stopEditingNotes}>
              Cancel
            </Button>
            {card.notes && (
              <Button variant="danger" size="xs" onClick={removeNotes}>
                Remove notes
              </Button>
            )}
            <span className="ml-auto text-xs text-muted" aria-hidden="true">
              {notesDraft.length}/{MAX_NOTES_LENGTH}
            </span>
          </div>
        </form>
      ) : (
        <div className="mt-2 flex flex-col gap-1 text-xs text-muted">
          <div className="flex items-center gap-1">
            {card.notes && (
              <span className="rounded-full bg-sky-50 px-2 py-0.5 font-medium text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                <span aria-hidden="true">📝 </span>Has notes
              </span>
            )}
            <Button
              ref={notesButtonRef}
              variant="ghost"
              size="xs"
              aria-label={`${card.notes ? "Edit" : "Add"} notes for "${card.title}"`}
              onClick={startEditingNotes}
            >
              {card.notes ? "Edit notes" : "Add notes"}
            </Button>
            {card.notes && (
              <Button
                variant="ghost"
                size="xs"
                aria-expanded={expanded}
                aria-controls={notesId}
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? "Hide notes" : "Show notes"}
              </Button>
            )}
          </div>
          {card.notes &&
            (expanded ? (
              <p id={notesId} className="whitespace-pre-wrap break-words text-sm text-subtle">
                {card.notes}
              </p>
            ) : (
              <p id={notesId} data-testid="notes-preview" className="truncate">
                {card.notes.split("\n")[0]}
              </p>
            ))}
        </div>
      )}
      <div className="mt-2 flex items-center gap-1">
        <Select
          fieldSize="sm"
          aria-label={`Priority of "${card.title}"`}
          value={card.priority}
          onChange={(event) => onSetPriority(event.target.value as Priority)}
        >
          {PRIORITIES.map(({ id, label }) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </Select>
        {previous && (
          <Button
            variant="ghost"
            size="xs"
            aria-label={`Move "${card.title}" to ${columnTitle(previous)}`}
            onClick={() => onMove(previous)}
          >
            ←
          </Button>
        )}
        {next && (
          <Button
            variant="ghost"
            size="xs"
            aria-label={`Move "${card.title}" to ${columnTitle(next)}`}
            onClick={() => onMove(next)}
          >
            →
          </Button>
        )}
        <Button
          ref={editRef}
          variant="ghost"
          size="xs"
          className="ml-auto"
          aria-label={`Edit "${card.title}"`}
          onClick={startEditing}
        >
          Edit
        </Button>
        <Button variant="danger" size="xs" aria-label={`Delete "${card.title}"`} onClick={onDelete}>
          Delete
        </Button>
      </div>
    </li>
  );
}
