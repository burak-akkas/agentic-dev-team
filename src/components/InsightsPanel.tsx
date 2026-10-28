"use client";

import { useId } from "react";
import { formatDueDate } from "@/lib/board";
import type { Board } from "@/lib/board";
import { cycleTimes, formatDuration, overdueCards, summarizeCycleTimes } from "@/lib/insights";
import { Button, Dialog } from "./ui";

function CycleTimeSection({ board, now }: { board: Board; now?: Date }) {
  const headingId = useId();
  const { durationsMs, excluded } = cycleTimes(board, { now });
  const summary = summarizeCycleTimes(durationsMs);
  return (
    <section aria-labelledby={headingId} className="flex min-w-0 flex-col gap-2">
      <h3 id={headingId} className="text-sm font-semibold">
        Cycle time
      </h3>
      {summary ? (
        <dl className="flex gap-6 text-sm">
          <div>
            <dt className="text-xs text-muted">Median</dt>
            <dd className="font-medium">{formatDuration(summary.median)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Average</dt>
            <dd className="font-medium">{formatDuration(summary.average)}</dd>
          </div>
        </dl>
      ) : (
        <p className="text-sm text-muted">No finished cards with a recorded Doing → Done history yet</p>
      )}
      {excluded > 0 && (
        <p className="text-xs text-muted">
          {excluded} {excluded === 1 ? "card" : "cards"} left out (no recorded Doing → Done history)
        </p>
      )}
    </section>
  );
}

function OverdueSection({ board, now, onOpenCard }: { board: Board; now?: Date; onOpenCard: (cardId: string) => void }) {
  const headingId = useId();
  const overdue = overdueCards(board, { now });
  return (
    <section aria-labelledby={headingId} className="flex min-w-0 flex-col gap-2">
      <h3 id={headingId} className="text-sm font-semibold">
        Overdue
      </h3>
      {overdue.length === 0 ? (
        <p className="text-sm text-muted">No overdue cards</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {overdue.map((card) => {
            const due = formatDueDate(card.dueDate ?? "");
            return (
              <li key={card.id}>
                <button
                  type="button"
                  aria-label={`Open "${card.title}" (due ${due})`}
                  onClick={() => onOpenCard(card.id)}
                  className="flex w-full min-w-0 items-center justify-between gap-3 rounded-md border border-line px-3 py-2 text-left text-sm outline-none hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-accent dark:border-field"
                >
                  <span className="min-w-0 break-words">{card.title}</span>
                  <span className="shrink-0 text-xs text-danger">{due}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function InsightsPanel({
  board,
  now,
  onClose,
  onOpenCard,
}: {
  board: Board;
  now?: Date;
  onClose: () => void;
  onOpenCard: (cardId: string) => void;
}) {
  const headingId = useId();
  return (
    <Dialog labelledBy={headingId} onRequestClose={onClose}>
      <div className="flex max-w-full min-w-0 flex-col gap-5 p-5">
        <h2 id={headingId} className="text-lg font-semibold">
          Board insights
        </h2>
        <CycleTimeSection board={board} now={now} />
        <OverdueSection board={board} now={now} onOpenCard={onOpenCard} />
        <div className="flex">
          <Button variant="primary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
