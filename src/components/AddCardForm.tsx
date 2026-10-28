"use client";

import { useState, type FormEvent } from "react";
import { MAX_TITLE_LENGTH } from "@/lib/board";

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
      <input
        aria-label="New card title"
        placeholder="What needs to be done?"
        value={title}
        maxLength={MAX_TITLE_LENGTH}
        onChange={(event) => setTitle(event.target.value)}
        className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-900"
      />
      <button
        type="submit"
        disabled={!title.trim()}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Add card
      </button>
    </form>
  );
}
