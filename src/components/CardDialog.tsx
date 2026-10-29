"use client";

import { useId, useState, type FormEvent } from "react";
import {
  addComment,
  addLabelToList,
  boardLists,
  COVER_COLORS,
  DEFAULT_LISTS,
  deleteComment,
  editComment,
  hasChanges,
  isValidDueDate,
  MAX_NOTES_LENGTH,
  MAX_TITLE_LENGTH,
  PRIORITIES,
  removeLabelFromList,
  type Board,
  type Card,
  type CardEdits,
  type ColumnId,
  type CoverColor,
  type Priority,
} from "@/lib/board";
import { coverStyles } from "./coverColors";

import { ActivityLog } from "./ActivityLog";
import { CardComments } from "./CardComments";
import { ChecklistSection } from "./ChecklistSection";
import { LabelChip } from "./LabelChip";
import { Button, Dialog, Input, Select, Textarea } from "./ui";

const labelStyles = "text-xs font-medium text-subtle";

export function CardDialog({
  card,
  column,
  onSave,
  onDelete,
  onDuplicate,
  onClose,
  onChecklist,
  onUpdateBoard,
  board,
}: {
  card: Card;
  column: ColumnId;
  // The board the card is on, for its lists. Without it the default three lists are offered.
  board?: Board;
  onChecklist?: (change: (board: Board) => Board) => void;
  onSave: (edits: CardEdits) => void;
  onDelete: () => void;
  // Duplicates the saved card (unsaved edits in this dialog are not copied).
  onDuplicate?: () => void;
  onClose: () => void;
  onUpdateBoard: (fn: (board: Board) => Board) => void;
}) {
  const headingId = useId();
  const [title, setTitle] = useState(card.title);
  const [notes, setNotes] = useState(card.notes ?? "");
  const [priority, setPriority] = useState<Priority>(card.priority);
  const [dueDate, setDueDate] = useState(card.dueDate ?? "");
  const [status, setStatus] = useState<ColumnId>(column);
  const [labels, setLabels] = useState<string[]>(card.labels ?? []);
  const [cover, setCover] = useState<CoverColor | undefined>(card.cover);
  const [labelInput, setLabelInput] = useState("");
  const [labelError, setLabelError] = useState<string | null>(null);

  function addLabel() {
    try {
      setLabels(addLabelToList(labels, labelInput));
      setLabelInput("");
      setLabelError(null);
    } catch (error) {
      setLabelError(error instanceof Error ? error.message : "Invalid label");
    }
  }

  const titleInvalid = !title.trim();
  const dueDateInvalid = dueDate !== "" && !isValidDueDate(dueDate);
  const invalid = titleInvalid || dueDateInvalid;

  const edits: CardEdits = {
    title,
    notes: notes.trim() || undefined,
    priority,
    dueDate: dueDate || undefined,
    column: status,
    labels,
    cover,
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
              {(board ? boardLists(board) : DEFAULT_LISTS).map(({ id, name }) => (
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

        <div className="flex flex-col gap-1">
          <span id={`${headingId}-cover`} className={labelStyles}>
            Cover color
          </span>
          {cover && (
            <div
              aria-hidden="true"
              data-testid="cover-preview"
              className={`h-1.5 w-full rounded-full ${coverStyles[cover]}`}
            />
          )}
          <div role="radiogroup" aria-labelledby={`${headingId}-cover`} className="flex flex-wrap gap-2">
            {[{ id: undefined, label: "None" }, ...COVER_COLORS].map(({ id, label }) => (
              <label key={id ?? "none"} className="relative cursor-pointer">
                <input
                  type="radio"
                  name={`${headingId}-cover`}
                  aria-label={`Cover color: ${label}`}
                  checked={cover === id}
                  onChange={() => setCover(id)}
                  className="peer sr-only"
                />
                <span
                  aria-hidden="true"
                  title={label}
                  className={`flex h-7 w-7 items-center justify-center rounded-full border-2 border-line text-sm font-bold text-white peer-checked:ring-2 peer-checked:ring-offset-2 peer-checked:ring-zinc-900 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-blue-600 dark:peer-checked:ring-zinc-100 dark:ring-offset-zinc-900 ${
                    id ? coverStyles[id] : "bg-surface text-muted"
                  }`}
                >
                  {cover === id ? (id ? "✓" : "–") : ""}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={`${headingId}-label`} className={labelStyles}>
            Labels
          </label>
          {labels.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {labels.map((label) => (
                <li key={label.toLowerCase()} className="flex items-center gap-1">
                  <LabelChip label={label} />
                  <Button
                    variant="ghost"
                    size="xs"
                    aria-label={`Remove label ${label}`}
                    onClick={() => setLabels(removeLabelFromList(labels, label))}
                  >
                    ×
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-center gap-2">
            <Input
              id={`${headingId}-label`}
              value={labelInput}
              aria-invalid={labelError !== null}
              aria-describedby={labelError ? `${headingId}-label-error` : undefined}
              onChange={(event) => {
                setLabelInput(event.target.value);
                setLabelError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addLabel();
                }
              }}
              className="w-full"
            />
            <Button size="sm" onClick={addLabel}>
              Add label
            </Button>
          </div>
          {labelError && (
            <p id={`${headingId}-label-error`} role="alert" className="text-xs text-danger">
              {labelError}
            </p>
          )}
        </div>

        {onChecklist && <ChecklistSection card={card} onChange={onChecklist} />}

        {/* Comment actions apply immediately; they are not part of the draft or the discard prompt. */}
        <CardComments
          comments={card.comments ?? []}
          onAdd={(text) => onUpdateBoard((b) => addComment(b, card.id, text))}
          onEdit={(id, text) => onUpdateBoard((b) => editComment(b, card.id, id, text))}
          onDelete={(id) => onUpdateBoard((b) => deleteComment(b, card.id, id))}
        />

        <p className="text-xs text-muted">
          Created <time dateTime={card.createdAt}>{new Date(card.createdAt).toLocaleString()}</time>
        </p>

        <div className="flex flex-col gap-1">
          <h3 className={labelStyles}>Activity</h3>
          <ActivityLog activity={card.activity} board={board} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" variant="primary" size="sm" disabled={invalid}>
            Save
          </Button>
          <Button variant="ghost" size="sm" onClick={requestClose}>
            Cancel
          </Button>
          {onDuplicate && (
            <Button variant="ghost" size="sm" title="Duplicates the saved card (unsaved edits are not copied)" onClick={onDuplicate}>
              Duplicate
            </Button>
          )}
          <Button variant="danger" size="sm" className="ml-auto" onClick={handleDelete}>
            Delete card
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
