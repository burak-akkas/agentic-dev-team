import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { addCard, emptyBoard } from "@/lib/board";
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

  it("persists cards across reloads", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Board />);
    await user.type(screen.getByLabelText("New card title"), "Remember me{Enter}");
    unmount();

    resetBoardStore();
    render(<Board />);
    expect(screen.getByText("Remember me")).toBeInTheDocument();
  });
});
