import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { addCard, emptyBoard, moveCard, toggleListCollapsed } from "@/lib/board";
import { saveBoard } from "../../../support/testStorage";
import { resetBoardStore } from "@/hooks/useBoard";
import { Board } from "@/components/board/Board";

function seed(collapsed = false) {
  let board = addCard(addCard(emptyBoard(), "A", { id: "a" }), "B", { id: "b" });
  board = moveCard(board, "b", "done");
  saveBoard(collapsed ? toggleListCollapsed(board, "done") : board);
}

describe("collapsing lists in <Board />", () => {
  beforeEach(() => resetBoardStore());

  it("every list has a Collapse button that is expanded", () => {
    seed();
    render(<Board />);
    for (const name of ["To do", "Doing", "Done"]) {
      expect(screen.getByRole("button", { name: `Collapse ${name}`, expanded: true })).toBeInTheDocument();
    }
  });

  it("collapses with the keyboard to a strip with name and count, and expands again", async () => {
    const user = userEvent.setup();
    seed();
    render(<Board />);

    screen.getByRole("button", { name: "Collapse Done" }).focus();
    await user.keyboard("{Enter}");

    await waitFor(() => expect(screen.getByRole("button", { name: "Expand Done", expanded: false })).toHaveFocus());
    expect(screen.getByRole("heading", { name: "Done1" })).toBeInTheDocument();
    expect(screen.queryByText("B")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Set WIP limit for Done" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Archive done" })).not.toBeInTheDocument();

    await user.keyboard(" ");
    expect(screen.getByRole("button", { name: "Collapse Done", expanded: true })).toBeInTheDocument();
    expect(screen.getByText("B")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Set WIP limit for Done" })).toBeInTheDocument();
  });

  it("loads boards with collapsed lists and keeps the real count under a filter", async () => {
    const user = userEvent.setup();
    seed(true);
    render(<Board />);
    expect(screen.getByRole("button", { name: "Expand Done" })).toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: "Search cards" }), "zzz");
    expect(screen.getByRole("heading", { name: "Done1" })).toBeInTheDocument();
  });

  it("collapsing a list discards an unsaved WIP limit edit and keeps focus on the toggle", async () => {
    const user = userEvent.setup();
    seed();
    render(<Board />);
    await user.click(screen.getByRole("button", { name: "Set WIP limit for Done" }));
    await user.type(screen.getByRole("textbox", { name: "WIP limit for Done" }), "5");

    await user.click(screen.getByRole("button", { name: "Collapse Done" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Expand Done" })).toHaveFocus());

    await user.click(screen.getByRole("button", { name: "Expand Done" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Collapse Done" })).toHaveFocus());
    expect(screen.queryByRole("textbox", { name: "WIP limit for Done" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Set WIP limit for Done", expanded: false })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Done1" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Set WIP limit for Done" }));
    expect(screen.getByRole("textbox", { name: "WIP limit for Done" })).toHaveValue("");
  });

  it("collapsing a list clears a pending WIP limit error", async () => {
    const user = userEvent.setup();
    seed();
    render(<Board />);
    await user.click(screen.getByRole("button", { name: "Set WIP limit for Done" }));
    await user.type(screen.getByRole("textbox", { name: "WIP limit for Done" }), "abc{Enter}");
    expect(screen.getByRole("alert")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Collapse Done" }));
    await user.click(screen.getByRole("button", { name: "Expand Done" }));
    await user.click(screen.getByRole("button", { name: "Set WIP limit for Done" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("collapsing keeps the saved WIP limit", async () => {
    const user = userEvent.setup();
    seed();
    render(<Board />);
    await user.click(screen.getByRole("button", { name: "Set WIP limit for Done" }));
    await user.type(screen.getByRole("textbox", { name: "WIP limit for Done" }), "3{Enter}");
    await user.click(screen.getByRole("button", { name: "Edit WIP limit for Done" }));
    await user.clear(screen.getByRole("textbox", { name: "WIP limit for Done" }));
    await user.type(screen.getByRole("textbox", { name: "WIP limit for Done" }), "9");

    await user.click(screen.getByRole("button", { name: "Collapse Done" }));
    expect(screen.getByRole("heading", { name: "Done1 / 3" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Expand Done" }));
    expect(screen.queryByRole("textbox", { name: "WIP limit for Done" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit WIP limit for Done", expanded: false })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Done1 / 3" })).toBeInTheDocument();
  });

  it("counts a card moved into a collapsed list and shows it when expanded", async () => {
    const user = userEvent.setup();
    seed();
    render(<Board />);
    await user.click(screen.getByRole("button", { name: "Collapse Doing" }));
    await user.click(screen.getByRole("button", { name: 'Move "A" to Doing' }));
    expect(screen.getByRole("heading", { name: "Doing1" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Expand Doing" }));
    expect(screen.getByText("A")).toBeInTheDocument();
  });
});
