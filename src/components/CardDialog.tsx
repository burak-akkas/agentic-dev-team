"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type SyntheticEvent } from "react";
import {
  COLUMNS,
  hasChanges,
  isValidDueDate,
  MAX_NOTES_LENGTH,
  MAX_TITLE_LENGTH,
  PRIORITIES,
  type Card,
  type CardEdits,
  type ColumnId,
  type Priority,
} from "@/lib/board";

const fieldStyles =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:[color-scheme:dark]";
const labelStyles = "text-xs font-medium text-zinc-600 dark:text-zinc-400";
const buttonStyles =
  "rounded-md px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100";

export function CardDialog({
  card,
  column,
  onSave,
  onDelete,
  onClose,
}: {
  card: Card;
  column: ColumnId;
  onSave: (edits: CardEdits) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const [title, setTitle] = useState(card.title);
  const [notes, setNotes] = useState(card.notes ?? "");
  const [priority, setPriority] = useState<Priority>(card.priority);
  const [dueDate, setDueDate] = useState(card.dueDate ?? "");
  const [status, setStatus] = useState<ColumnId>(column);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
  }, []);

  const titleInvalid = !title.trim();
  const dueDateInvalid = dueDate !== "" && !isValidDueDate(dueDate);
  const invalid = titleInvalid || dueDateInvalid;

  const edits: CardEdits = {
    title,
    notes: notes.trim() || undefined,
    priority,
    dueDate: dueDate || undefined,
    column: status,
  };

  // Closing with unsaved changes needs confirmation.
  function requestClose() {
    if (hasChanges(card, column, edits) && !window.confirm("Discard your unsaved changes?")) {
      return;
    }
    onClose();
  }

  function handleCancel(event: SyntheticEvent<HTMLDialogElement>) {
    // Escape: take over from the browser so unsaved changes can be confirmed first.
    event.preventDefault();
    requestClose();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (invalid) {
      return;
    }
    onSave(edits);
  }

  function handleDelete() {
    if (window.confirm(`Delete "${card.title}"?`)) {
      onDelete();
    }
  }

  return (
    // A click whose target is the <dialog> itself can only land on the backdrop (padding lives on the inner form).
    <dialog
      ref={dialogRef}
      aria-labelledby={headingId}
      onCancel={handleCancel}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          requestClose();
        }
      }}
      className="m-auto max-h-[90dvh] w-[calc(100%-1rem)] max-w-lg overflow-y-auto rounded-xl border border-zinc-200 bg-white p-0 text-zinc-900 shadow-xl backdrop:bg-black/50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5">
        <h2 id={headingId} className="break-words text-lg font-semibold">
          {card.title}
        </h2>

        <div className="flex flex-col gap-1">
          <label htmlFor={`${headingId}-title`} className={labelStyles}>
            Title
          </label>
          <input
            id={`${headingId}-title`}
            value={title}
            maxLength={MAX_TITLE_LENGTH}
            aria-invalid={titleInvalid}
            aria-describedby={titleInvalid ? `${headingId}-title-error` : undefined}
            onChange={(event) => setTitle(event.target.value)}
            className={fieldStyles}
          />
          {titleInvalid && (
            <p id={`${headingId}-title-error`} role="alert" className="text-xs text-red-600 dark:text-red-400">
              Title must not be empty
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={`${headingId}-description`} className={labelStyles}>
            Description
          </label>
          <textarea
            id={`${headingId}-description`}
            value={notes}
            maxLength={MAX_NOTES_LENGTH}
            rows={5}
            onChange={(event) => setNotes(event.target.value)}
            className={fieldStyles}
          />
          <span className="self-end text-xs text-zinc-500" aria-hidden="true">
            {notes.length}/{MAX_NOTES_LENGTH}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor={`${headingId}-status`} className={labelStyles}>
              Status
            </label>
            <select
              id={`${headingId}-status`}
              value={status}
              onChange={(event) => setStatus(event.target.value as ColumnId)}
              className={fieldStyles}
            >
              {COLUMNS.map(({ id, title: name }) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={`${headingId}-priority`} className={labelStyles}>
              Priority
            </label>
            <select
              id={`${headingId}-priority`}
              value={priority}
              onChange={(event) => setPriority(event.target.value as Priority)}
              className={fieldStyles}
            >
              {PRIORITIES.map(({ id, label }) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={`${headingId}-due`} className={labelStyles}>
            Due date
          </label>
          <div className="flex items-center gap-2">
            <input
              id={`${headingId}-due`}
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              className={fieldStyles}
            />
            {dueDate && (
              <button type="button" className={buttonStyles} onClick={() => setDueDate("")}>
                Clear due date
              </button>
            )}
          </div>
        </div>

        <p className="text-xs text-zinc-500">
          Created <time dateTime={card.createdAt}>{new Date(card.createdAt).toLocaleString()}</time>
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={invalid}
            className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Save
          </button>
          <button type="button" className={buttonStyles} onClick={requestClose}>
            Cancel
          </button>
          <button
            type="button"
            className={`${buttonStyles} ml-auto hover:text-red-600 dark:hover:text-red-400`}
            onClick={handleDelete}
          >
            Delete card
          </button>
        </div>
      </form>
    </dialog>
  );
}
