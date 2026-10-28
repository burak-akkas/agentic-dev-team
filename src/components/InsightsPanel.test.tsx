import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { addCard, emptyBoard, moveCard, setDueDate } from "@/lib/board";
import type { Board } from "@/lib/board";
import { InsightsPanel } from "./InsightsPanel";

const NOW = new Date(2026, 5, 10, 12, 0, 0);

function finished(board: Board, id: string, title: string, hours: number): Board {
  const start = new Date(2026, 5, 9, 8, 0, 0);
  const end = new Date(start.getTime() + hours * 3_600_000);
  let next = addCard(board, title, { id, now: start });
  next = moveCard(next, id, "doing", { now: start });
  return moveCard(next, id, "done", { now: end });
}

function renderPanel(board: Board, props: { onOpenCard?: (id: string) => void; onClose?: () => void } = {}) {
  const onOpenCard = props.onOpenCard ?? vi.fn();
  const onClose = props.onClose ?? vi.fn();
  render(<InsightsPanel board={board} now={NOW} onClose={onClose} onOpenCard={onOpenCard} />);
  return { onOpenCard, onClose };
}

describe("<InsightsPanel />", () => {
  it("shows median and average cycle time as durations", () => {
    let board = finished(emptyBoard(), "a", "A", 2);
    board = finished(board, "b", "B", 4);
    board = finished(board, "c", "C", 9);
    renderPanel(board);
    const section = screen.getByRole("region", { name: "Cycle time" });
    expect(within(section).getByText("Median").nextSibling).toHaveTextContent("4h");
    expect(within(section).getByText("Average").nextSibling).toHaveTextContent("5h");
    expect(within(section).queryByText(/left out/)).not.toBeInTheDocument();
  });

  it("states how many cards were left out, singular and plural", () => {
    let board = finished(emptyBoard(), "a", "A", 2);
    board = moveCard(addCard(board, "No history", { id: "x" }), "x", "done");
    board = moveCard(board, "x", "todo");
    board = moveCard(board, "x", "done");
    renderPanel(board);
    expect(screen.getByText("1 card left out (no recorded Doing → Done history)")).toBeInTheDocument();
  });

  it("uses the plural for several excluded cards", () => {
    let board = emptyBoard();
    for (const id of ["x", "y"]) {
      board = addCard(board, id, { id });
      board = moveCard(board, id, "done");
    }
    renderPanel(board);
    expect(screen.getByText("2 cards left out (no recorded Doing → Done history)")).toBeInTheDocument();
    expect(screen.getByText(/No finished cards with a recorded/)).toBeInTheDocument();
  });

  it("shows an empty state for cycle time", () => {
    renderPanel(emptyBoard());
    expect(screen.getByText(/No finished cards with a recorded/)).toBeInTheDocument();
    expect(screen.queryByText("Median")).not.toBeInTheDocument();
  });

  it("lists overdue cards as buttons and opens the chosen one", async () => {
    let board = addCard(emptyBoard(), "Late", { id: "late" });
    board = setDueDate(board, "late", "2026-06-01");
    board = addCard(board, "Fine", { id: "fine" });
    board = setDueDate(board, "fine", "2026-07-01");
    const { onOpenCard } = renderPanel(board);
    expect(screen.queryByRole("button", { name: /Open "Fine"/ })).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: /^Open "Late" \(due / }));
    expect(onOpenCard).toHaveBeenCalledWith("late");
  });

  it("does not list done cards as overdue and shows an empty state", () => {
    let board = finished(emptyBoard(), "a", "A", 1);
    board = setDueDate(board, "a", "2026-06-01");
    renderPanel(board);
    expect(screen.getByText("No overdue cards")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Open "A"/ })).not.toBeInTheDocument();
  });

  it("calls onClose from the Close button", async () => {
    const { onClose } = renderPanel(emptyBoard());
    await userEvent.setup().click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalled();
  });
});
