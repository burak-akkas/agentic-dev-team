import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { addCard, emptyBoard, moveCard, setWipLimit } from "@/lib/board";
import { saveBoard } from "@/lib/testStorage";
import { resetBoardStore } from "@/lib/useBoard";
import { Board } from "./Board";

const column = (name: string) => screen.getByRole("region", { name: new RegExp(`^${name}`) });

function boardWith(titles: string[], doing: number, limit?: number) {
  let board = emptyBoard();
  titles.forEach((title, i) => {
    board = addCard(board, title, { id: `c${i}` });
    if (i < doing) {
      board = moveCard(board, `c${i}`, "doing");
    }
  });
  if (limit !== undefined) {
    board = setWipLimit(board, "doing", limit);
  }
  saveBoard(board);
}

describe("WIP limits in <Board />", () => {
  beforeEach(() => resetBoardStore());

  it("shows only the count when there is no limit", () => {
    boardWith(["A", "B"], 2);
    render(<Board />);
    expect(screen.getByRole("heading", { name: "Doing2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Set WIP limit for Doing" })).toBeInTheDocument();
  });

  it("sets a limit with the keyboard and shows count / limit", async () => {
    const user = userEvent.setup();
    boardWith(["A", "B"], 2);
    render(<Board />);

    screen.getByRole("button", { name: "Set WIP limit for Doing" }).focus();
    await user.keyboard("{Enter}");
    await user.keyboard("4{Enter}");

    expect(screen.getByRole("heading", { name: "Doing2 / 4" })).toBeInTheDocument();
    expect(screen.queryByText(/limit by/)).not.toBeInTheDocument();
    expect(screen.queryByText("At limit")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Edit WIP limit for Doing" })).toHaveFocus());
  });

  it("clears the limit with empty input", async () => {
    const user = userEvent.setup();
    boardWith(["A"], 1, 3);
    render(<Board />);

    await user.click(screen.getByRole("button", { name: "Edit WIP limit for Doing" }));
    await user.clear(screen.getByLabelText("WIP limit for Doing"));
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("heading", { name: "Doing1" })).toBeInTheDocument();
  });

  it("clears the limit with the Clear button", async () => {
    const user = userEvent.setup();
    boardWith(["A"], 1, 3);
    render(<Board />);

    await user.click(screen.getByRole("button", { name: "Edit WIP limit for Doing" }));
    await user.click(screen.getByRole("button", { name: "Clear WIP limit for Doing" }));
    expect(screen.getByRole("heading", { name: "Doing1" })).toBeInTheDocument();
  });

  it.each(["0", "-1", "1.5", "abc", "100", "99999999999"])("rejects %j and keeps the old limit", async (input) => {
    const user = userEvent.setup();
    boardWith(["A"], 1, 3);
    render(<Board />);

    await user.click(screen.getByRole("button", { name: "Edit WIP limit for Doing" }));
    await user.clear(screen.getByLabelText("WIP limit for Doing"));
    await user.type(screen.getByLabelText("WIP limit for Doing"), input);
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Enter a whole number from 1 to 99.");
    expect(screen.getByLabelText("WIP limit for Doing")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("heading", { name: "Doing1 / 3" })).toBeInTheDocument();
  });

  it("cancels with Escape", async () => {
    const user = userEvent.setup();
    boardWith(["A"], 1);
    render(<Board />);

    await user.click(screen.getByRole("button", { name: "Set WIP limit for Doing" }));
    await user.type(screen.getByLabelText("WIP limit for Doing"), "2{Escape}");
    expect(screen.queryByLabelText("WIP limit for Doing")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Doing1" })).toBeInTheDocument();
  });

  it("flags the at-limit state with text", () => {
    boardWith(["A", "B"], 2, 2);
    render(<Board />);
    expect(within(column("Doing")).getByText("At limit")).toBeInTheDocument();
  });

  it("flags the over-limit state with the number", () => {
    boardWith(["A", "B", "C"], 3, 1);
    render(<Board />);
    expect(within(column("Doing")).getByText("Over limit by 2")).toBeInTheDocument();
  });

  it("shows no warning below the limit and warns right after lowering it", async () => {
    const user = userEvent.setup();
    boardWith(["A", "B", "C"], 3, 5);
    render(<Board />);
    expect(screen.queryByText(/limit by|At limit/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Edit WIP limit for Doing" }));
    await user.clear(screen.getByLabelText("WIP limit for Doing"));
    await user.type(screen.getByLabelText("WIP limit for Doing"), "2{Enter}");
    expect(screen.getByText("Over limit by 1")).toBeInTheDocument();
  });

  it("is never blocked: moving into a full column works and warns", async () => {
    const user = userEvent.setup();
    boardWith(["A", "B"], 1, 1);
    render(<Board />);
    expect(screen.getByText("At limit")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: 'Move "B" to Doing' }));
    expect(within(column("Doing")).getByText("B")).toBeInTheDocument();
    expect(screen.getByText("Over limit by 1")).toBeInTheDocument();
  });

  it("compares the real count to the limit while searching", async () => {
    const user = userEvent.setup();
    boardWith(["Alpha", "Beta", "Gamma"], 3, 3);
    render(<Board />);

    await user.type(screen.getByLabelText("Search cards"), "Alpha");
    expect(screen.getByRole("heading", { name: "Doing3 / 3" })).toBeInTheDocument();
    expect(screen.getByText("At limit")).toBeInTheDocument();
  });
});
