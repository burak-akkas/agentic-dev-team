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
