import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { addCard, addChecklistItem, emptyBoard, MAX_CHECKLIST_ITEM_LENGTH, toggleChecklistItem } from "@/lib/board";
import { saveBoard } from "../../support/testStorage";
import { resetBoardStore } from "@/lib/useBoard";
import { Board } from "@/components/Board";

function seed(items: string[] = []) {
  let board = addCard(emptyBoard(), "Plain", { id: "p" });
  board = addCard(board, "Task", { id: "t" });
  items.forEach((text, i) => {
    board = addChecklistItem(board, "t", text, { id: `i${i}` });
  });
  saveBoard(board);
}

async function openTask(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Task" }));
  return screen.getByRole("dialog", { name: "Task" });
}

describe("<Board /> checklist", () => {
  beforeEach(() => resetBoardStore());

  it("adds, ticks, edits, reorders and deletes items in the dialog", async () => {
    seed();
    const user = userEvent.setup();
    render(<Board />);
    const dialog = await openTask(user);

    const input = within(dialog).getByLabelText("New checklist item");
    expect(input).toHaveAttribute("maxlength", String(MAX_CHECKLIST_ITEM_LENGTH));
    await user.type(input, "  First{Enter}");
    await user.type(input, "Second");
    await user.click(within(dialog).getByRole("button", { name: "Add item" }));
    // Enter added the item without submitting (closing) the dialog.
    expect(screen.getByRole("dialog", { name: "Task" })).toBeInTheDocument();
    expect(within(dialog).getAllByRole("checkbox")).toHaveLength(2);

    await user.click(within(dialog).getByRole("checkbox", { name: "First" }));
    expect(within(dialog).getByRole("checkbox", { name: "First" })).toBeChecked();

    expect(within(dialog).getByRole("button", { name: 'Move up "First"' })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: 'Move down "Second"' })).toBeDisabled();
    await user.click(within(dialog).getByRole("button", { name: 'Move down "First"' }));
    expect(within(dialog).getAllByRole("checkbox").map((c) => (c as HTMLInputElement).checked)).toEqual([false, true]);

    await user.click(within(dialog).getByRole("button", { name: 'Edit checklist item "Second"' }));
    const edit = within(dialog).getByLabelText('Edit checklist item "Second"');
    await user.clear(edit);
    await user.type(edit, "Renamed{Enter}");
    expect(within(dialog).getByRole("checkbox", { name: "Renamed" })).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: 'Delete checklist item "Renamed"' }));
    expect(within(dialog).getAllByRole("checkbox")).toHaveLength(1);
  });

  it("shows an error for empty items and keeps the dialog open", async () => {
    seed();
    const user = userEvent.setup();
    render(<Board />);
    const dialog = await openTask(user);
    await user.type(within(dialog).getByLabelText("New checklist item"), "   {Enter}");
    expect(within(dialog).getByRole("alert")).toHaveTextContent("must not be empty");
    expect(within(dialog).queryAllByRole("checkbox")).toHaveLength(0);
  });

  it("keeps checklist changes on Cancel without a discard prompt, and on Save", async () => {
    seed(["a"]);
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const user = userEvent.setup();
    render(<Board />);
    let dialog = await openTask(user);
    await user.click(within(dialog).getByRole("checkbox", { name: "a" }));
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(confirm).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "1 of 1 checklist items done" })).toBeInTheDocument();

    dialog = await openTask(user);
    await user.click(within(dialog).getByRole("checkbox", { name: "a" }));
    await user.type(within(dialog).getByLabelText("Title"), "!");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(screen.getByRole("img", { name: "0 of 1 checklist items done" })).toBeInTheDocument();
  });

  it("shows a progress badge only on cards with a checklist", () => {
    let board = addCard(emptyBoard(), "Plain", { id: "p" });
    board = addCard(board, "Task", { id: "t" });
    for (let i = 0; i < 5; i++) {
      board = addChecklistItem(board, "t", `item ${i}`, { id: `i${i}` });
    }
    board = toggleChecklistItem(toggleChecklistItem(board, "t", "i0"), "t", "i1");
    saveBoard(board);
    render(<Board />);
    const badge = screen.getByRole("img", { name: "2 of 5 checklist items done" });
    expect(badge).toHaveTextContent("2/5");
    expect(screen.getAllByRole("img", { name: /checklist items done/ })).toHaveLength(1);
  });
});
