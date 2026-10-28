"use client";

import { useId, useState, type FormEvent } from "react";
import { MAX_BOARD_NAME_LENGTH, type NameResult } from "@/lib/boards";
import { useBoards } from "@/lib/useBoard";

import { Button, Dialog, Input, Select } from "./ui";

type Dialogs = "create" | "rename" | "delete" | null;

function BoardNameDialog({
  title,
  submitLabel,
  initialName,
  onSubmit,
  onClose,
}: {
  title: string;
  submitLabel: string;
  initialName: string;
  onSubmit: (name: string) => NameResult;
  onClose: () => void;
}) {
  const id = useId();
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  function submit(event: FormEvent) {
    event.preventDefault();
    const result = onSubmit(name);
    if (result.ok) {
      onClose();
    } else {
      setError(result.error);
    }
  }

  return (
    <Dialog labelledBy={`${id}-title`} onRequestClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3 p-5">
        <h2 id={`${id}-title`} className="text-lg font-semibold">
          {title}
        </h2>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Board name
          <Input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${hintId} ${errorId}` : hintId}
          />
        </label>
        <p id={hintId} className="text-xs text-subtle">
          Up to {MAX_BOARD_NAME_LENGTH} characters ({name.trim().length}/{MAX_BOARD_NAME_LENGTH})
        </p>
        {error && (
          <p id={errorId} role="alert" className="text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary">
            {submitLabel}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function DeleteBoardDialog({ name, onConfirm, onClose }: { name: string; onConfirm: () => void; onClose: () => void }) {
  const id = useId();
  return (
    <Dialog labelledBy={`${id}-title`} onRequestClose={onClose}>
      <div className="flex flex-col gap-3 p-5">
        <h2 id={`${id}-title`} className="text-lg font-semibold">
          Delete board
        </h2>
        <p className="text-sm">
          Delete &ldquo;{name}&rdquo; and all its cards? This cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <Button autoFocus onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onConfirm}>
            Delete
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

export function BoardSwitcher() {
  const { boards, currentId, createBoard, renameBoard, deleteBoard, selectBoard } = useBoards();
  const [dialog, setDialog] = useState<Dialogs>(null);
  const current = boards.find((b) => b.id === currentId) ?? boards[0];
  const close = () => setDialog(null);

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <Select
        aria-label="Board"
        value={currentId}
        onChange={(event) => selectBoard(event.target.value)}
        className="max-w-full min-w-0"
      >
        {boards.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </Select>
      <Button aria-label="New board" onClick={() => setDialog("create")}>
        New
      </Button>
      <Button aria-label="Rename board" onClick={() => setDialog("rename")}>
        Rename
      </Button>
      <Button aria-label="Delete board" disabled={boards.length <= 1} onClick={() => setDialog("delete")}>
        Delete
      </Button>
      {dialog === "create" && (
        <BoardNameDialog title="New board" submitLabel="Create" initialName="" onSubmit={createBoard} onClose={close} />
      )}
      {dialog === "rename" && (
        <BoardNameDialog
          title="Rename board"
          submitLabel="Rename"
          initialName={current.name}
          onSubmit={(name) => renameBoard(current.id, name)}
          onClose={close}
        />
      )}
      {dialog === "delete" && (
        <DeleteBoardDialog
          name={current.name}
          onConfirm={() => {
            deleteBoard(current.id);
            close();
          }}
          onClose={close}
        />
      )}
    </div>
  );
}
