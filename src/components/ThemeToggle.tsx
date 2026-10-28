"use client";

import type { ThemePreference } from "@/lib/theme";
import { useTheme } from "@/lib/useTheme";

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export function ThemeToggle() {
  const [preference, setPreference] = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="inline-flex shrink-0 self-start rounded-lg border border-zinc-300 bg-white p-0.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
    >
      {OPTIONS.map(({ value, label }) => (
        <label
          key={value}
          className="relative cursor-pointer rounded-md px-3 py-1 text-zinc-700 has-[:checked]:bg-zinc-900 has-[:checked]:text-white has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-blue-500 dark:text-zinc-300 dark:has-[:checked]:bg-zinc-100 dark:has-[:checked]:text-zinc-900"
        >
          <input
            type="radio"
            name="theme"
            value={value}
            checked={preference === value}
            onChange={() => setPreference(value)}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
          {label}
        </label>
      ))}
    </div>
  );
}
