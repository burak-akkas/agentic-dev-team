"use client";

import type { BoardStats } from "@/lib/board";
import { Surface } from "./ui";

export function SummaryBar({
  stats,
  overdueOnly,
  onToggleOverdue,
}: {
  stats: BoardStats;
  overdueOnly: boolean;
  onToggleOverdue: () => void;
}) {
  if (stats.total === 0) {
    return (
      <Surface aria-label="Board summary" className="text-center text-sm text-muted">
        No cards yet. Add one to see your progress.
      </Surface>
    );
  }

  return (
    <Surface aria-label="Board summary" className="flex flex-col gap-3 text-sm">
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
          className="h-2 flex-1 overflow-hidden rounded-full bg-line"
        >
          <div className="h-full bg-emerald-600 dark:bg-emerald-500" style={{ width: `${stats.percentDone}%` }} />
        </div>
        <span className="w-24 text-right text-xs text-subtle">{stats.percentDone}% done</span>
      </div>
    </Surface>
  );
}
