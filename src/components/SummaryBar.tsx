"use client";

import type { BoardStats } from "@/lib/board";

export function SummaryBar({
  stats,
  overdueOnly,
  onToggleOverdue,
}: {
  stats: BoardStats;
  overdueOnly: boolean;
  onToggleOverdue: () => void;
}) {
  const box =
    "rounded-xl border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900";

  if (stats.total === 0) {
    return (
      <section aria-label="Board summary" className={`${box} text-center text-zinc-500`}>
        No cards yet. Add one to see your progress.
      </section>
    );
  }

  return (
    <section aria-label="Board summary" className={`${box} flex flex-col gap-3`}>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <p>
          <span className="font-semibold">{stats.total}</span> {stats.total === 1 ? "card" : "cards"} total
        </p>
        {stats.overdue > 0 ? (
          <button
            type="button"
            aria-pressed={overdueOnly}
            aria-label={`Overdue: ${stats.overdue}. ${overdueOnly ? "Show all cards" : "Show only overdue cards"}`}
            onClick={onToggleOverdue}
            className={`rounded-md border px-2 py-0.5 font-medium ${
              overdueOnly
                ? "border-red-600 bg-red-600 text-white dark:border-red-500 dark:bg-red-500 dark:text-zinc-950"
                : "border-red-300 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950"
            }`}
          >
            <span aria-hidden="true">⚠ </span>
            Overdue: {stats.overdue}
          </button>
        ) : (
          <p>Overdue: 0</p>
        )}
        <p>High priority open: {stats.highOpen}</p>
      </div>
      <div className="flex items-center gap-3">
        <div
          role="progressbar"
          aria-label="Cards done"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={stats.percentDone}
          aria-valuetext={`${stats.percentDone}% done (${stats.done} of ${stats.total})`}
          className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
        >
          <div className="h-full bg-emerald-600 dark:bg-emerald-500" style={{ width: `${stats.percentDone}%` }} />
        </div>
        <span className="w-24 text-right text-xs text-zinc-600 dark:text-zinc-400">{stats.percentDone}% done</span>
      </div>
    </section>
  );
}
