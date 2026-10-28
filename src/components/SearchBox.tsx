"use client";

import { useRef } from "react";

export function SearchBox({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        aria-label="Search cards"
        placeholder="Search cards"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            onChange("");
          }
        }}
        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 pr-10 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-900"
      />
      {value !== "" && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            onChange("");
            inputRef.current?.focus();
          }}
          className="absolute inset-y-0 right-0 rounded-lg px-3 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          ×
        </button>
      )}
    </div>
  );
}
