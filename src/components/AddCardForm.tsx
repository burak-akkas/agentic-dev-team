"use client";

import { useState, type FormEvent } from "react";
import { MAX_TITLE_LENGTH } from "@/lib/board";
import { Button, Input } from "./ui";

export function AddCardForm({ onAdd }: { onAdd: (title: string) => void }) {
  const [title, setTitle] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) {
      return;
    }
    onAdd(title);
    setTitle("");
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input
        aria-label="New card title"
        placeholder="What needs to be done?"
        value={title}
        maxLength={MAX_TITLE_LENGTH}
        onChange={(event) => setTitle(event.target.value)}
        className="min-w-0 flex-1"
      />
      <Button type="submit" variant="primary" disabled={!title.trim()}>
        Add card
      </Button>
    </form>
  );
}
