import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { addCard, emptyBoard, formatDueDate, moveCard, setDueDate, todayString } from "@/lib/board";
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

  describe("editing a title", () => {
    const seed = () => {
      let board = addCard(emptyBoard(), "Buy milk", { id: "a" });
      board = addCard(board, "Walk dog", { id: "b" });
      board = addCard(board, "Read", { id: "c" });
      saveBoard(board);
    };
    const titles = (name: string) =>
      within(column(name))
        .getAllByRole("listitem")
        .map((li) => li.querySelector("p")?.textContent);

    it("shows a focused, pre-filled input with Save and Cancel", async () => {
      const user = userEvent.setup();
      seed();
      render(<Board />);

      await user.click(screen.getByRole("button", { name: 'Edit "Buy milk"' }));
      const input = screen.getByLabelText("Card title");
      expect(input).toHaveValue("Buy milk");
      expect(input).toHaveFocus();
      expect(input).toHaveAttribute("maxlength", "120");
      expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    });

    it("saves a trimmed title with Enter, keeping position, and restores focus", async () => {
      const user = userEvent.setup();
      seed();
      render(<Board />);

      await user.click(screen.getByRole("button", { name: 'Edit "Walk dog"' }));
      await user.clear(screen.getByLabelText("Card title"));
      await user.type(screen.getByLabelText("Card title"), "  Feed cat  {Enter}");

      expect(titles("To do")).toEqual(["Buy milk", "Feed cat", "Read"]);
      expect(screen.queryByLabelText("Card title")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: 'Edit "Feed cat"' })).toHaveFocus();
    });

    it("saves with the Save button and persists to localStorage", async () => {
      const user = userEvent.setup();
      seed();
      const { unmount } = render(<Board />);

      await user.click(screen.getByRole("button", { name: 'Edit "Buy milk"' }));
      await user.clear(screen.getByLabelText("Card title"));
      await user.type(screen.getByLabelText("Card title"), "Buy oat milk");
      await user.click(screen.getByRole("button", { name: "Save" }));
      unmount();

      resetBoardStore();
      render(<Board />);
      expect(screen.getByText("Buy oat milk")).toBeInTheDocument();
    });

    it("keeps a card in its column when renamed", async () => {
      const user = userEvent.setup();
      seed();
      render(<Board />);
      await user.click(screen.getByRole("button", { name: 'Move "Walk dog" to Doing' }));

      await user.click(screen.getByRole("button", { name: 'Edit "Walk dog"' }));
      await user.type(screen.getByLabelText("Card title"), "gy{Enter}");

      expect(titles("Doing")).toEqual(["Walk doggy"]);
      expect(titles("To do")).toEqual(["Buy milk", "Read"]);
    });

    it("discards changes on Escape and on Cancel, restoring focus", async () => {
      const user = userEvent.setup();
      seed();
      render(<Board />);

      await user.click(screen.getByRole("button", { name: 'Edit "Buy milk"' }));
      await user.type(screen.getByLabelText("Card title"), " changed{Escape}");
      expect(screen.getByText("Buy milk")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: 'Edit "Buy milk"' })).toHaveFocus();

      await user.click(screen.getByRole("button", { name: 'Edit "Buy milk"' }));
      await user.type(screen.getByLabelText("Card title"), " changed");
      await user.click(screen.getByRole("button", { name: "Cancel" }));
      expect(screen.getByText("Buy milk")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: 'Edit "Buy milk"' })).toHaveFocus();
    });

    it("does not save a blank title", async () => {
      const user = userEvent.setup();
      seed();
      render(<Board />);

      await user.click(screen.getByRole("button", { name: 'Edit "Buy milk"' }));
      await user.clear(screen.getByLabelText("Card title"));
      await user.type(screen.getByLabelText("Card title"), "   ");
      expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();

      await user.keyboard("{Enter}");
      expect(screen.getByLabelText("Card title")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Cancel" }));
      expect(titles("To do")).toEqual(["Buy milk", "Walk dog", "Read"]);
    });

    it("saving an unchanged title is harmless", async () => {
      const user = userEvent.setup();
      seed();
      render(<Board />);

      await user.click(screen.getByRole("button", { name: 'Edit "Buy milk"' }));
      await user.click(screen.getByRole("button", { name: "Save" }));
      expect(titles("To do")).toEqual(["Buy milk", "Walk dog", "Read"]);
    });
  });

  describe("due dates", () => {
    const seed = (dueDate?: string) => {
      const board = addCard(emptyBoard(), "Pay rent", { id: "a" });
      saveBoard(dueDate ? setDueDate(board, "a", dueDate) : board);
    };
    const dateInput = () => screen.getByLabelText('Due date for "Pay rent"');

    it("sets, changes and clears a due date, moving focus to the input on clear", async () => {
      const user = userEvent.setup();
      seed();
      render(<Board />);
      expect(screen.queryByText("Overdue")).not.toBeInTheDocument();

      fireEvent.change(dateInput(), { target: { value: "2999-10-28" } });
      expect(dateInput()).toHaveValue("2999-10-28");
      expect(screen.getByText(formatDueDate("2999-10-28"))).toBeInTheDocument();
      expect(screen.queryByText("Overdue")).not.toBeInTheDocument();

      fireEvent.change(dateInput(), { target: { value: "2999-11-02" } });
      expect(screen.getByText(formatDueDate("2999-11-02"))).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: 'Clear due date for "Pay rent"' }));
      expect(dateInput()).toHaveValue("");
      expect(dateInput()).toHaveFocus();
      expect(screen.queryByRole("button", { name: /Clear due date/ })).not.toBeInTheDocument();
    });

    it("clears when the native input is emptied", () => {
      seed("2999-10-28");
      render(<Board />);
      fireEvent.change(dateInput(), { target: { value: "" } });
      expect(screen.queryByRole("time")).not.toBeInTheDocument();
    });

    it("is reachable with the keyboard", async () => {
      const user = userEvent.setup();
      seed();
      render(<Board />);
      await user.tab();
      await user.tab();
      await user.tab();
      expect(dateInput()).toHaveFocus();
    });

    it("persists across reloads", () => {
      seed();
      const { unmount } = render(<Board />);
      fireEvent.change(dateInput(), { target: { value: "2999-10-28" } });
      unmount();
      resetBoardStore();
      render(<Board />);
      expect(dateInput()).toHaveValue("2999-10-28");
    });

    it("marks past dates overdue unless the card is in Done, and updates on move", async () => {
      const user = userEvent.setup();
      seed("2000-01-01");
      render(<Board />);
      expect(within(column("To do")).getByText(/Overdue/)).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: 'Move "Pay rent" to Doing' }));
      expect(within(column("Doing")).getByText(/Overdue/)).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: 'Move "Pay rent" to Done' }));
      expect(screen.queryByText(/Overdue/)).not.toBeInTheDocument();
      expect(dateInput()).toHaveValue("2000-01-01");

      await user.click(screen.getByRole("button", { name: 'Move "Pay rent" to Doing' }));
      expect(screen.getByText(/Overdue/)).toBeInTheDocument();
    });

    it("does not mark a card due today as overdue", () => {
      seed(todayString());
      render(<Board />);
      expect(screen.getByRole("time")).toBeInTheDocument();
      expect(screen.queryByText(/Overdue/)).not.toBeInTheDocument();
    });
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
