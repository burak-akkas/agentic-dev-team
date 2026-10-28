"use client";

import { useId, useState, type FormEvent } from "react";
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

import { Button, Dialog, Input, Select, Textarea } from "./ui";

const labelStyles = "text-xs font-medium text-subtle";

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
  const headingId = useId();
  const [title, setTitle] = useState(card.title);
  const [notes, setNotes] = useState(card.notes ?? "");
  const [priority, setPriority] = useState<Priority>(card.priority);
  const [dueDate, setDueDate] = useState(card.dueDate ?? "");
  const [status, setStatus] = useState<ColumnId>(column);

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
    // Escape and backdrop clicks go through requestClose so unsaved changes can be confirmed first.
    <Dialog labelledBy={headingId} onRequestClose={requestClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5">
        <h2 id={headingId} className="break-words text-lg font-semibold">
          {card.title}
        </h2>

        <div className="flex flex-col gap-1">
          <label htmlFor={`${headingId}-title`} className={labelStyles}>
            Title
          </label>
          <Input
            id={`${headingId}-title`}
            value={title}
            maxLength={MAX_TITLE_LENGTH}
            aria-invalid={titleInvalid}
            aria-describedby={titleInvalid ? `${headingId}-title-error` : undefined}
            onChange={(event) => setTitle(event.target.value)}
            className="w-full"
          />
          {titleInvalid && (
            <p id={`${headingId}-title-error`} role="alert" className="text-xs text-danger">
              Title must not be empty
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={`${headingId}-description`} className={labelStyles}>
            Description
          </label>
          <Textarea
            id={`${headingId}-description`}
            value={notes}
            maxLength={MAX_NOTES_LENGTH}
            rows={5}
            onChange={(event) => setNotes(event.target.value)}
            className="w-full"
          />
          <span className="self-end text-xs text-muted" aria-hidden="true">
            {notes.length}/{MAX_NOTES_LENGTH}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor={`${headingId}-status`} className={labelStyles}>
              Status
            </label>
            <Select
              id={`${headingId}-status`}
              value={status}
              onChange={(event) => setStatus(event.target.value as ColumnId)}
              className="w-full"
            >
              {COLUMNS.map(({ id, title: name }) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={`${headingId}-priority`} className={labelStyles}>
              Priority
            </label>
            <Select
              id={`${headingId}-priority`}
              value={priority}
              onChange={(event) => setPriority(event.target.value as Priority)}
              className="w-full"
            >
              {PRIORITIES.map(({ id, label }) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={`${headingId}-due`} className={labelStyles}>
            Due date
          </label>
          <div className="flex items-center gap-2">
            <Input
              id={`${headingId}-due`}
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              className="w-full"
            />
            {dueDate && (
              <Button variant="ghost" size="sm" onClick={() => setDueDate("")}>
                Clear due date
              </Button>
            )}
          </div>
        </div>

        <p className="text-xs text-muted">
          Created <time dateTime={card.createdAt}>{new Date(card.createdAt).toLocaleString()}</time>
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" variant="primary" size="sm" disabled={invalid}>
            Save
          </Button>
          <Button variant="ghost" size="sm" onClick={requestClose}>
            Cancel
          </Button>
          <Button variant="danger" size="sm" className="ml-auto" onClick={handleDelete}>
            Delete card
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
