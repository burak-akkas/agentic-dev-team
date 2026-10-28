import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { addCard, emptyBoard, moveCard } from "@/lib/board";
import { saveBoard } from "@/lib/storage";
import { resetBoardStore } from "@/lib/useBoard";
import { Board } from "./Board";

const column = (name: string) => screen.getByRole("region", { name: new RegExp(`^${name}`) });

describe("<Board />", () => {
  beforeEach(() => resetBoardStore());

  it("adds a card to To do and clears the input", async () => {
    const user = userEvent.setup();
    render(<Board />);

    await user.type(screen.getByLabelText("New card title"), "Write docs");
    await user.click(screen.getByRole("button", { name: "Add card" }));

    expect(within(column("To do")).getByText("Write docs")).toBeInTheDocument();
    expect(screen.getByLabelText("New card title")).toHaveValue("");
  });

  it("disables Add card for a blank title", async () => {
    const user = userEvent.setup();
    render(<Board />);

    await user.type(screen.getByLabelText("New card title"), "   ");
    expect(screen.getByRole("button", { name: "Add card" })).toBeDisabled();
  });

  it("moves a card right and left between columns", async () => {
    const user = userEvent.setup();
    saveBoard(addCard(emptyBoard(), "Ship it", { id: "a" }));
    render(<Board />);

    await user.click(screen.getByRole("button", { name: 'Move "Ship it" to Doing' }));
    expect(within(column("Doing")).getByText("Ship it")).toBeInTheDocument();
    expect(within(column("To do")).getByText("No cards")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: 'Move "Ship it" to To do' }));
    expect(within(column("To do")).getByText("Ship it")).toBeInTheDocument();
  });

  it("deletes a card", async () => {
    const user = userEvent.setup();
    saveBoard(addCard(emptyBoard(), "Oops", { id: "a" }));
    render(<Board />);

    await user.click(screen.getByRole("button", { name: 'Delete "Oops"' }));
    expect(screen.queryByText("Oops")).not.toBeInTheDocument();
  });

  it("persists cards across reloads", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Board />);
    await user.type(screen.getByLabelText("New card title"), "Remember me{Enter}");
    unmount();

    resetBoardStore();
    render(<Board />);
    expect(screen.getByText("Remember me")).toBeInTheDocument();
  });

  describe("search", () => {
    function seed() {
      let board = addCard(emptyBoard(), "Write docs", { id: "a" });
      board = addCard(board, "Fix bug", { id: "b" });
      board = addCard(board, "Docs review", { id: "c" });
      board = moveCard(board, "c", "doing");
      saveBoard(board);
    }

    it("filters cards in every column and updates the counters", async () => {
      const user = userEvent.setup();
      seed();
      render(<Board />);

      await user.type(screen.getByLabelText("Search cards"), "  DOCS ");

      expect(within(column("To do")).getByText("Write docs")).toBeInTheDocument();
      expect(within(column("Doing")).getByText("Docs review")).toBeInTheDocument();
      expect(screen.queryByText("Fix bug")).not.toBeInTheDocument();
      expect(column("To do")).toHaveTextContent("To do1");
      expect(column("Doing")).toHaveTextContent("Doing1");
      expect(column("Done")).toHaveTextContent("Done0");
      expect(within(column("Done")).getByText("No matching cards")).toBeInTheDocument();
    });

    it("shows 'No cards' for an empty column without a filter", () => {
      seed();
      render(<Board />);
      expect(within(column("Done")).getByText("No cards")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Clear search" })).not.toBeInTheDocument();
    });

    it("clears the filter with the × button", async () => {
      const user = userEvent.setup();
      seed();
      render(<Board />);

      await user.type(screen.getByLabelText("Search cards"), "docs");
      await user.click(screen.getByRole("button", { name: "Clear search" }));

      expect(screen.getByLabelText("Search cards")).toHaveValue("");
      expect(screen.getByLabelText("Search cards")).toHaveFocus();
      expect(screen.getByText("Fix bug")).toBeInTheDocument();
      expect(column("To do")).toHaveTextContent("To do2");
    });

    it("clears the filter with Escape", async () => {
      const user = userEvent.setup();
      seed();
      render(<Board />);

      await user.type(screen.getByLabelText("Search cards"), "docs{Escape}");

      expect(screen.getByLabelText("Search cards")).toHaveValue("");
      expect(screen.getByText("Fix bug")).toBeInTheDocument();
    });

    it("keeps the filter and acts on the right card when moving or deleting", async () => {
      const user = userEvent.setup();
      seed();
      render(<Board />);
      await user.type(screen.getByLabelText("Search cards"), "docs");

      await user.click(screen.getByRole("button", { name: 'Move "Write docs" to Doing' }));
      expect(within(column("Doing")).getByText("Write docs")).toBeInTheDocument();
      expect(screen.getByLabelText("Search cards")).toHaveValue("docs");

      await user.click(screen.getByRole("button", { name: 'Delete "Docs review"' }));
      expect(screen.queryByText("Docs review")).not.toBeInTheDocument();

      await user.clear(screen.getByLabelText("Search cards"));
      expect(screen.getByText("Fix bug")).toBeInTheDocument();
    });

    it("does not modify stored data", async () => {
      const user = userEvent.setup();
      seed();
      const before = JSON.stringify(localStorage);
      render(<Board />);

      await user.type(screen.getByLabelText("Search cards"), "docs");

      expect(JSON.stringify(localStorage)).toBe(before);
    });
  });
});
