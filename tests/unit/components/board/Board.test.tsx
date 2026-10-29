import { act, createEvent, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addCard, emptyBoard, formatDueDate, moveCard, setDueDate, setNotes, setPriority, todayString } from "@/lib/board";
import { saveBoard } from "../../../support/testStorage";
import { resetBoardStore } from "@/hooks/useBoard";
import { Board } from "@/components/board/Board";
import { UNDO_TOAST_MS } from "@/components/board/UndoToast";

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
        .map((li) => li.querySelector("button.card-title")?.textContent);

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

    it("ignores invalid values from the native input instead of throwing", () => {
      seed("2999-10-28");
      render(<Board />);
      fireEvent.change(dateInput(), { target: { value: "20261-10-28" } });
      expect(screen.getByRole("time")).toHaveTextContent(formatDueDate("2999-10-28"));
    });

    it("is reachable with the keyboard", async () => {
      const user = userEvent.setup();
      seed();
      render(<Board />);
      for (let i = 0; i < 14 && document.activeElement !== dateInput(); i++) {
        await user.tab();
      }
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
      expect(within(column("Done")).queryByText(/Overdue/)).not.toBeInTheDocument();
      expect(dateInput()).toHaveValue("2000-01-01");

      await user.click(screen.getByRole("button", { name: 'Move "Pay rent" to Doing' }));
      expect(within(column("Doing")).getByText(/Overdue/)).toBeInTheDocument();
    });

    it("does not mark a card due today as overdue", () => {
      seed(todayString());
      render(<Board />);
      expect(screen.getByRole("time")).toBeInTheDocument();
      expect(within(column("To do")).queryByText(/Overdue/)).not.toBeInTheDocument();
    });
  });

  describe("priority", () => {
    const badge = (name: string) => within(screen.getByText(name).closest("li") as HTMLElement).getByTestId("priority-badge");

    it("shows a Medium badge on new cards", async () => {
      const user = userEvent.setup();
      render(<Board />);
      await user.type(screen.getByLabelText("New card title"), "Task{Enter}");

      expect(badge("Task")).toHaveTextContent("Medium");
      expect(screen.getByLabelText('Priority of "Task"')).toHaveValue("medium");
    });

    it("changes the priority with the select, keeping column and persisting", async () => {
      const user = userEvent.setup();
      saveBoard(moveCard(addCard(emptyBoard(), "Task", { id: "a" }), "a", "doing"));
      const { unmount } = render(<Board />);

      await user.selectOptions(screen.getByLabelText('Priority of "Task"'), "high");
      expect(badge("Task")).toHaveTextContent("High");
      expect(within(column("Doing")).getByText("Task")).toBeInTheDocument();
      unmount();

      resetBoardStore();
      render(<Board />);
      expect(badge("Task")).toHaveTextContent("High");
    });

    it("is reachable with the keyboard and keeps priority after rename and move", async () => {
      const user = userEvent.setup();
      saveBoard(addCard(emptyBoard(), "Task", { id: "a" }));
      render(<Board />);

      // Tab through the page chrome and the card's controls until the priority select is reached.
      const select = screen.getByLabelText('Priority of "Task"');
      for (let i = 0; i < 15 && document.activeElement !== select; i++) {
        await user.tab();
      }
      expect(select).toHaveFocus();
      await user.selectOptions(select, "high");
      expect(badge("Task")).toHaveTextContent("High");

      await user.click(screen.getByRole("button", { name: 'Edit "Task"' }));
      await user.type(screen.getByLabelText("Card title"), " 2{Enter}");
      await user.click(screen.getByRole("button", { name: 'Move "Task 2" to Doing' }));
      expect(badge("Task 2")).toHaveTextContent("High");
    });
  });

  describe("notes", () => {
    const seed = (notes?: string) => {
      const board = addCard(emptyBoard(), "Plan trip", { id: "a" });
      saveBoard(notes ? setNotes(board, "a", notes) : board);
    };
    const textarea = () => screen.getByLabelText('Notes for "Plan trip"');
    const openButton = (name: string) => screen.getByRole("button", { name: `${name} notes for "Plan trip"` });

    it("shows no indicator or preview on cards without notes", () => {
      seed();
      render(<Board />);
      expect(screen.queryByText("Has notes")).not.toBeInTheDocument();
      expect(screen.queryByTestId("notes-preview")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Show notes/ })).not.toBeInTheDocument();
    });

    it("adds notes, with Enter inserting a newline, and shows indicator and first-line preview", async () => {
      const user = userEvent.setup();
      seed();
      render(<Board />);

      await user.click(openButton("Add"));
      expect(textarea()).toHaveAttribute("maxLength", "1000");
      expect(textarea()).toHaveFocus();
      await user.type(textarea(), "Book flights{Enter}Pack bags");
      expect(textarea()).toHaveValue("Book flights\nPack bags");

      await user.click(screen.getByRole("button", { name: "Save notes" }));
      expect(screen.getByText("Has notes")).toBeInTheDocument();
      expect(screen.getByTestId("notes-preview")).toHaveTextContent("Book flights");
      expect(screen.getByTestId("notes-preview")).not.toHaveTextContent("Pack bags");
      expect(openButton("Edit")).toHaveFocus();
    });

    it("expands to the full text and collapses again", async () => {
      const user = userEvent.setup();
      seed("Line one\nLine two");
      render(<Board />);

      const toggle = screen.getByRole("button", { name: "Show notes" });
      expect(toggle).toHaveAttribute("aria-expanded", "false");
      await user.click(toggle);
      expect(toggle).toHaveAttribute("aria-expanded", "true");
      expect(toggle).toHaveTextContent("Hide notes");
      const full = document.getElementById(toggle.getAttribute("aria-controls") as string);
      expect(full?.textContent).toBe("Line one\nLine two");
      await user.click(toggle);
      expect(toggle).toHaveAttribute("aria-expanded", "false");
      expect(screen.getByTestId("notes-preview")).toHaveTextContent("Line one");
    });

    it("cancels with Escape, restoring focus and keeping the old notes", async () => {
      const user = userEvent.setup();
      seed("Original");
      render(<Board />);

      await user.click(openButton("Edit"));
      await user.clear(textarea());
      await user.type(textarea(), "Changed{Escape}");
      expect(screen.queryByLabelText('Notes for "Plan trip"')).not.toBeInTheDocument();
      expect(screen.getByTestId("notes-preview")).toHaveTextContent("Original");
      expect(openButton("Edit")).toHaveFocus();
    });

    it("cancels with the Cancel button", async () => {
      const user = userEvent.setup();
      seed();
      render(<Board />);

      await user.click(openButton("Add"));
      await user.type(textarea(), "Draft");
      await user.click(screen.getByRole("button", { name: "Cancel" }));
      expect(screen.queryByText("Has notes")).not.toBeInTheDocument();
      expect(openButton("Add")).toHaveFocus();
    });

    it("edits existing notes", async () => {
      const user = userEvent.setup();
      seed("Old");
      render(<Board />);

      await user.click(openButton("Edit"));
      expect(textarea()).toHaveValue("Old");
      await user.clear(textarea());
      await user.type(textarea(), "New");
      await user.click(screen.getByRole("button", { name: "Save notes" }));
      expect(screen.getByTestId("notes-preview")).toHaveTextContent("New");
    });

    it("removes notes by saving blank text or with Remove notes", async () => {
      const user = userEvent.setup();
      seed("Something");
      render(<Board />);

      await user.click(openButton("Edit"));
      await user.clear(textarea());
      await user.click(screen.getByRole("button", { name: "Save notes" }));
      expect(screen.queryByText("Has notes")).not.toBeInTheDocument();

      await user.click(openButton("Add"));
      expect(screen.queryByRole("button", { name: "Remove notes" })).not.toBeInTheDocument();
      await user.type(textarea(), "Again");
      await user.click(screen.getByRole("button", { name: "Save notes" }));
      await user.click(openButton("Edit"));
      await user.click(screen.getByRole("button", { name: "Remove notes" }));
      expect(screen.queryByText("Has notes")).not.toBeInTheDocument();
      expect(openButton("Add")).toHaveFocus();
    });

    it("renders HTML-like text literally", async () => {
      const user = userEvent.setup();
      seed("<b>x</b>");
      render(<Board />);
      await user.click(screen.getByRole("button", { name: "Show notes" }));
      expect(screen.getByText("<b>x</b>")).toBeInTheDocument();
      expect(document.querySelector("b")).toBeNull();
    });

    it("persists across reloads and survives rename and move", async () => {
      const user = userEvent.setup();
      seed("Keep me");
      const { unmount } = render(<Board />);
      await user.click(screen.getByRole("button", { name: 'Edit "Plan trip"' }));
      await user.type(screen.getByLabelText("Card title"), " 2{Enter}");
      await user.click(screen.getByRole("button", { name: 'Move "Plan trip 2" to Doing' }));
      unmount();

      resetBoardStore();
      render(<Board />);
      expect(within(column("Doing")).getByTestId("notes-preview")).toHaveTextContent("Keep me");
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

    it("filters cards in every column and keeps the real counters", async () => {
      const user = userEvent.setup();
      seed();
      render(<Board />);

      await user.type(screen.getByLabelText("Search cards"), "  DOCS ");

      expect(within(column("To do")).getByText("Write docs")).toBeInTheDocument();
      expect(within(column("Doing")).getByText("Docs review")).toBeInTheDocument();
      expect(screen.queryByText("Fix bug")).not.toBeInTheDocument();
      // The counters show the real column size, so they stay comparable to WIP limits while filtering.
      expect(column("To do")).toHaveTextContent("To do2");
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

  describe("drag and drop", () => {
    const TYPE = "application/x-kanban-card";
    const makeTransfer = (types: string[] = [], data: Record<string, string> = {}) => {
      const store = { ...data };
      return {
        types,
        effectAllowed: "",
        dropEffect: "",
        setData(type: string, value: string) {
          store[type] = value;
          if (!this.types.includes(type)) this.types.push(type);
        },
        getData: (type: string) => store[type] ?? "",
      };
    };
    const card = (title: string) => screen.getByText(title).closest("li") as HTMLElement;
    const seed = () => {
      let b = addCard(emptyBoard(), "Alpha", { id: "a" });
      b = addCard(b, "Beta", { id: "b" });
      saveBoard(b);
    };
    const startDrag = (title: string) => {
      const dataTransfer = makeTransfer();
      fireEvent.dragStart(card(title), { dataTransfer });
      return dataTransfer;
    };
    const storedColumn = (id: string) =>
      (JSON.parse(localStorage.getItem(localStorage.key(0) as string) as string) as {
        boards: { board: { columns: Record<string, { id: string }[]> } }[];
      }).boards[0].board.columns[id].map((c) => c.id);

    it("moves a card to the end of another column and persists it", () => {
      seed();
      render(<Board />);
      const dt = startDrag("Alpha");
      fireEvent.drop(column("Done"), { dataTransfer: dt });

      expect(within(column("Done")).getByText("Alpha")).toBeInTheDocument();
      expect(within(column("To do")).queryByText("Alpha")).not.toBeInTheDocument();
      expect(storedColumn("done")).toEqual(["a"]);
    });

    it("accepts drops on the header and the empty state", () => {
      seed();
      render(<Board />);
      fireEvent.drop(within(column("Doing")).getByRole("heading"), { dataTransfer: startDrag("Alpha") });
      expect(within(column("Doing")).getByText("Alpha")).toBeInTheDocument();

      fireEvent.drop(within(column("Done")).getByText("No cards"), { dataTransfer: startDrag("Beta") });
      expect(within(column("Done")).getByText("Beta")).toBeInTheDocument();
    });

    it("moves the real card while a search filter is active", async () => {
      const user = userEvent.setup();
      seed();
      render(<Board />);
      await user.type(screen.getByLabelText("Search cards"), "alpha");
      fireEvent.drop(column("Doing"), { dataTransfer: startDrag("Alpha") });
      await user.clear(screen.getByLabelText("Search cards"));

      expect(within(column("Doing")).getByText("Alpha")).toBeInTheDocument();
      expect(within(column("To do")).getByText("Beta")).toBeInTheDocument();
    });

    it("highlights the target column and clears it on leave, drop and dragend", () => {
      seed();
      render(<Board />);
      const dt = startDrag("Alpha");
      const done = column("Done");

      fireEvent.dragEnter(done, { dataTransfer: dt });
      expect(done).toHaveClass("ring-2");
      fireEvent.dragLeave(done, { dataTransfer: dt });
      expect(done).not.toHaveClass("ring-2");

      fireEvent.dragOver(done, { dataTransfer: dt });
      // jsdom has no DragEvent, so relatedTarget has to be set by hand
      const leave = createEvent.dragLeave(done, { dataTransfer: dt });
      Object.defineProperty(leave, "relatedTarget", { value: within(done).getByRole("heading") });
      fireEvent(done, leave);
      expect(done).toHaveClass("ring-2");

      fireEvent.dragEnd(card("Alpha"));
      expect(done).not.toHaveClass("ring-2");

      fireEvent.dragOver(done, { dataTransfer: dt });
      expect(done).not.toHaveClass("ring-2"); // dragend cleared the source

      const dt2 = startDrag("Alpha");
      fireEvent.dragOver(done, { dataTransfer: dt2 });
      expect(done).toHaveClass("ring-2");
      fireEvent.drop(done, { dataTransfer: dt2 });
      expect(screen.getByRole("region", { name: /^Done/ })).not.toHaveClass("ring-2");
    });

    it("ignores drops on the source column and shows no highlight", () => {
      seed();
      render(<Board />);
      const dt = startDrag("Alpha");
      const todo = column("To do");
      fireEvent.dragOver(todo, { dataTransfer: dt });
      expect(todo).not.toHaveClass("ring-2");
      fireEvent.drop(todo, { dataTransfer: dt });
      const titles = within(todo).getAllByRole("listitem").map((li) => li.textContent);
      expect(titles[0]).toContain("Alpha");
      expect(titles[1]).toContain("Beta");
    });

    it("ignores foreign drags and unknown card ids", () => {
      seed();
      render(<Board />);
      const done = column("Done");
      expect(() => {
        fireEvent.dragOver(done, { dataTransfer: makeTransfer(["text/plain"], { "text/plain": "a" }) });
        fireEvent.drop(done, { dataTransfer: makeTransfer(["Files"]) });
      }).not.toThrow();
      expect(done).not.toHaveClass("ring-2");
      expect(within(done).getByText("No cards")).toBeInTheDocument();

      startDrag("Alpha");
      fireEvent.drop(done, { dataTransfer: makeTransfer([TYPE], { [TYPE]: "missing" }) });
      expect(within(done).getByText("No cards")).toBeInTheDocument();
    });

    it("keeps the move buttons and does not make an editing card draggable", async () => {
      const user = userEvent.setup();
      seed();
      render(<Board />);
      expect(card("Alpha")).toHaveAttribute("draggable", "true");

      await user.click(screen.getByRole("button", { name: 'Move "Alpha" to Doing' }));
      expect(within(column("Doing")).getByText("Alpha")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: 'Edit "Beta"' }));
      expect(screen.getByLabelText("Card title").closest("li")).not.toHaveAttribute("draggable");
    });
  });

  describe("card dialog", () => {
    const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));

    function seedOne() {
      saveBoard(addCard(emptyBoard(), "Alpha", { id: "a" }));
    }

    afterEach(() => vi.restoreAllMocks());

    it("duplicates the saved card, ignoring unsaved edits, and opens the copy", async () => {
      const user = userEvent.setup();
      seedOne();
      render(<Board />);
      await user.click(screen.getByRole("button", { name: "Alpha" }));
      const dialog = screen.getByRole("dialog", { name: "Alpha" });
      await user.type(within(dialog).getByLabelText("Title"), " unsaved");
      await user.click(within(dialog).getByRole("button", { name: "Duplicate" }));

      expect(screen.getByRole("dialog", { name: "Alpha (copy)" })).toBeInTheDocument();
      expect(within(screen.getByRole("dialog")).getByLabelText("Title")).toHaveValue("Alpha (copy)");
      expect(within(screen.getByRole("dialog")).getByText("created as a copy of Alpha")).toBeInTheDocument();
      await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));
      const titles = within(column("To do")).getAllByRole("button", { name: /^Alpha/ });
      expect(titles.map((t) => t.textContent)).toEqual(["Alpha", "Alpha (copy)"]);
    });

    it("opens on click and on Enter, and saves all edits to the board and storage", async () => {
      const user = userEvent.setup();
      seedOne();
      render(<Board />);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

      const open = screen.getByRole("button", { name: "Alpha" });
      open.focus();
      await user.keyboard("{Enter}");
      const dialog = screen.getByRole("dialog", { name: "Alpha" });

      await user.clear(within(dialog).getByLabelText("Title"));
      await user.type(within(dialog).getByLabelText("Title"), "Beta");
      await user.type(within(dialog).getByLabelText("Description"), "Details");
      await user.selectOptions(within(dialog).getByLabelText("Status"), "done");
      await user.selectOptions(within(dialog).getByLabelText("Priority"), "high");
      await user.click(within(dialog).getByRole("button", { name: "Save" }));

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(within(column("Done")).getByText("Beta")).toBeInTheDocument();
      expect(within(column("Done")).getByTestId("priority-badge")).toHaveTextContent("High");
      expect(within(column("Done")).getByText("Details")).toBeInTheDocument();
      expect(localStorage.getItem(localStorage.key(0) as string)).toContain("Details");

      await nextFrame();
      expect(screen.getByRole("button", { name: "Beta" })).toHaveFocus();
    });

    it("discards changes on Cancel", async () => {
      const user = userEvent.setup();
      seedOne();
      render(<Board />);

      await user.click(screen.getByRole("button", { name: "Alpha" }));
      await user.type(screen.getByLabelText("Title"), "zzz");
      await user.click(screen.getByRole("button", { name: "Cancel" }));
      await user.click(within(screen.getByRole("dialog", { name: "Discard changes" })).getByRole("button", { name: "Discard" }));

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(within(column("To do")).getByText("Alpha")).toBeInTheDocument();
    });

    it("deletes the card after confirmation and keeps it when declined", async () => {
      const user = userEvent.setup();
      seedOne();
      render(<Board />);

      await user.click(screen.getByRole("button", { name: "Alpha" }));
      await user.click(screen.getByRole("button", { name: "Delete card" }));
      await user.click(within(screen.getByRole("dialog", { name: "Delete card" })).getByRole("button", { name: "Cancel" }));
      expect(screen.getByRole("dialog", { name: "Alpha" })).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Delete card" }));
      await user.click(within(screen.getByRole("dialog", { name: "Delete card" })).getByRole("button", { name: "Delete" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(within(column("To do")).getByText("No cards")).toBeInTheDocument();
    });
  });

  describe("archive", () => {
    const seed = () => {
      let board = addCard(emptyBoard(), "First", { id: "a" });
      board = addCard(board, "Second", { id: "b" });
      board = addCard(board, "Third", { id: "c" });
      board = moveCard(board, "a", "done");
      board = moveCard(board, "b", "done");
      saveBoard(board);
    };

    it("disables Archive done when Done is empty", () => {
      render(<Board />);
      expect(screen.getByRole("button", { name: "Archive done" })).toBeDisabled();
    });

    it("archives Done cards, leaves other columns and shows an Undo notification", async () => {
      const user = userEvent.setup();
      seed();
      render(<Board />);

      await user.click(screen.getByRole("button", { name: "Archive done" }));
      expect(within(column("Done")).getByText("No cards")).toBeInTheDocument();
      expect(within(column("To do")).getByText("Third")).toBeInTheDocument();
      expect(screen.getByRole("status")).toHaveTextContent("Archived 2 done cards");
      expect(screen.getByRole("button", { name: "Archived (2)" })).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Undo" }));
      const titles = within(column("Done"))
        .getAllByRole("listitem")
        .map((li) => li.textContent);
      expect(titles[0]).toContain("First");
      expect(titles[1]).toContain("Second");
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Archived (0)" })).toBeInTheDocument();
    });

    it("hides the notification after a few seconds", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        seed();
        render(<Board />);
        await user.click(screen.getByRole("button", { name: "Archive done" }));
        expect(screen.getByRole("status")).toBeInTheDocument();
        act(() => {
          vi.advanceTimersByTime(UNDO_TOAST_MS + 100);
        });
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
      } finally {
        vi.useRealTimers();
      }
    });

    it("toggles the archive list, with an empty state", async () => {
      const user = userEvent.setup();
      render(<Board />);

      const toggle = screen.getByRole("button", { name: "Archived (0)" });
      expect(toggle).toHaveAttribute("aria-expanded", "false");
      toggle.focus();
      await user.keyboard("{Enter}");
      expect(toggle).toHaveAttribute("aria-expanded", "true");
      expect(screen.getByText("No archived cards")).toBeInTheDocument();
      await user.keyboard(" ");
      expect(toggle).toHaveAttribute("aria-expanded", "false");
      expect(screen.queryByText("No archived cards")).not.toBeInTheDocument();
    });

    it("restores and permanently deletes archived cards", async () => {
      const user = userEvent.setup();
      seed();
      render(<Board />);
      await user.click(screen.getByRole("button", { name: "Archive done" }));
      await user.click(screen.getByRole("button", { name: "Archived (2)" }));

      const panel = screen.getByRole("region", { name: "Archived cards" });
      expect(within(panel).getByText("First")).toBeInTheDocument();

      await user.click(within(panel).getByRole("button", { name: 'Restore "First"' }));
      expect(within(column("Done")).getByText("First")).toBeInTheDocument();
      expect(within(panel).queryByText("First")).not.toBeInTheDocument();

      await user.click(within(panel).getByRole("button", { name: 'Delete "Second" permanently' }));
      expect(within(panel).getByText("No archived cards")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Archived (0)" })).toBeInTheDocument();
    });
  });

  describe("summary bar", () => {
    const summary = () => screen.getByRole("region", { name: "Board summary" });

    it("shows a friendly empty state", () => {
      render(<Board />);
      expect(within(summary()).getByText(/No cards yet/)).toBeInTheDocument();
      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    });

    it("shows live totals, progress and high priority count", async () => {
      const user = userEvent.setup();
      let board = addCard(addCard(emptyBoard(), "One", { id: "a" }), "Two", { id: "b" });
      board = setPriority(board, "a", "high");
      saveBoard(board);
      render(<Board />);

      expect(within(summary()).getByText("2")).toBeInTheDocument();
      expect(within(summary()).getByText("High priority open: 1")).toBeInTheDocument();
      expect(screen.getByRole("progressbar", { name: "Cards done" })).toHaveAttribute("aria-valuenow", "0");

      await user.click(screen.getByRole("button", { name: 'Move "One" to Doing' }));
      await user.click(screen.getByRole("button", { name: 'Move "One" to Done' }));
      expect(screen.getByRole("progressbar", { name: "Cards done" })).toHaveAttribute("aria-valuenow", "50");
      expect(within(summary()).getByText("50% done")).toBeInTheDocument();
      expect(within(summary()).getByText("High priority open: 0")).toBeInTheDocument();
    });

    it("filters to overdue cards when the overdue count is clicked and toggles back", async () => {
      const user = userEvent.setup();
      let board = addCard(addCard(emptyBoard(), "Late", { id: "a" }), "Fine", { id: "b" });
      board = setDueDate(board, "a", "2000-01-01");
      saveBoard(board);
      render(<Board />);

      const button = within(summary()).getByRole("button", { name: /Overdue: 1/ });
      expect(button).toHaveAttribute("aria-pressed", "false");
      await user.click(button);
      expect(button).toHaveAttribute("aria-pressed", "true");
      expect(within(column("To do")).getByText("Late")).toBeInTheDocument();
      expect(within(column("To do")).queryByText("Fine")).not.toBeInTheDocument();

      await user.click(button);
      expect(within(column("To do")).getByText("Fine")).toBeInTheDocument();
    });

    it("drops the overdue filter once nothing is overdue", async () => {
      const user = userEvent.setup();
      saveBoard(setDueDate(addCard(emptyBoard(), "Late", { id: "a" }), "a", "2000-01-01"));
      render(<Board />);

      await user.click(within(summary()).getByRole("button", { name: /Overdue: 1/ }));
      await user.click(screen.getByRole("button", { name: 'Move "Late" to Doing' }));
      await user.click(screen.getByRole("button", { name: 'Move "Late" to Done' }));
      expect(within(summary()).getByText("Overdue: 0")).toBeInTheDocument();
      expect(within(column("Done")).getByText("Late")).toBeInTheDocument();
    });
  });
});
