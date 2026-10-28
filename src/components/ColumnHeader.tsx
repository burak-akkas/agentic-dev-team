"use client";

import { useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { MAX_WIP_LIMIT, parseWipLimit, wipStatus } from "@/lib/board";
import { Button, Input } from "./ui";

interface ColumnHeaderProps {
  id: string;
  title: string;
  // The real (unfiltered) number of cards in the column.
  total: number;
  limit: number | undefined;
  onSetLimit: (limit: number | undefined) => void;
  children?: ReactNode;
}

export function ColumnHeader({ id, title, total, limit, onSetLimit, children }: ColumnHeaderProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const editButton = useRef<HTMLButtonElement>(null);
  const status = wipStatus(total, limit);

  function open() {
    setDraft(limit === undefined ? "" : String(limit));
    setError(null);
    setEditing(true);
  }

  function close() {
    setEditing(false);
    setError(null);
    requestAnimationFrame(() => editButton.current?.focus());
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = parseWipLimit(draft);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSetLimit(result.limit);
    close();
  }

  function clear() {
    onSetLimit(undefined);
    close();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  }

  const badgeTone =
    status.state === "over"
      ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200"
      : status.state === "at"
        ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
        : "bg-line text-subtle";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h2 id={`column-${id}`} className="flex items-center gap-2 px-1 text-sm font-semibold">
            {title}
            <span className={`rounded-full px-2 text-xs font-medium ${badgeTone}`}>
              {limit === undefined ? total : `${total} / ${limit}`}
            </span>
          </h2>
          {status.state === "at" && (
            <span className="text-xs font-medium text-amber-800 dark:text-amber-300">At limit</span>
          )}
          {status.state === "over" && (
            <span className="text-xs font-medium text-red-700 dark:text-red-300">Over limit by {status.over}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            ref={editButton}
            size="xs"
            variant="ghost"
            aria-label={`${limit === undefined ? "Set" : "Edit"} WIP limit for ${title}`}
            aria-expanded={editing}
            onClick={() => (editing ? close() : open())}
          >
            {limit === undefined ? "Set limit" : "Edit limit"}
          </Button>
          {children}
        </div>
      </div>
      {editing && (
        <form onSubmit={save} className="flex flex-col gap-2" noValidate>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              autoFocus
              fieldSize="sm"
              inputMode="numeric"
              aria-label={`WIP limit for ${title}`}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `wip-error-${id}` : undefined}
              placeholder={`1-${MAX_WIP_LIMIT}`}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleKeyDown}
              className="w-20"
            />
            <Button type="submit" size="xs" variant="primary">
              Save
            </Button>
            <Button size="xs" onClick={clear} aria-label={`Clear WIP limit for ${title}`}>
              Clear
            </Button>
            <Button size="xs" variant="ghost" onClick={close} aria-label={`Cancel editing WIP limit for ${title}`}>
              Cancel
            </Button>
          </div>
          {error && (
            <p id={`wip-error-${id}`} role="alert" className="px-1 text-xs text-danger">
              {error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
