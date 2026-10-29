import { createEvent, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { Board } from "@/components/Board";
import { BoardSwitcher } from "@/components/BoardSwitcher";
import { resetBoardStore } from "@/lib/useBoard";

function setup() {
  const user = userEvent.setup();
  render(
    <>
      <BoardSwitcher />
      <Board />
    </>,
  );
  return { user };
}

const select = () => screen.getByRole("combobox", { name: "Board" });
const selectedName = () => (select() as HTMLSelectElement).selectedOptions[0]?.textContent;
const optionNames =() => within(select()).getAllByRole("option").map((o) => o.textContent);

async function create(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole("button", { name: "New board" }));
  const input = screen.getByLabelText("Board name");
  await user.clear(input);
  await user.type(input, name);
  await user.click(screen.getByRole("button", { name: "Create" }));
}

describe("<BoardSwitcher />", () => {
  beforeEach(() => {
    localStorage.clear();
    resetBoardStore();
  });

  it("shows the current board and lists all boards", async () => {
    const { user } = setup();
    expect(selectedName()).toBe("My board");
    await create(user, "Work");
    expect(optionNames()).toEqual(["My board", "Work"]);
    expect(selectedName()).toBe("Work");
  });

  it("styles the board select like the label filter select", () => {
    setup();
    const board = select();
    const filter = screen.getByRole("combobox", { name: "Filter by label" });
    expect(board).toHaveClass("px-3", "py-2");
    expect(board).not.toHaveClass("text-xs");
    expect(filter).toHaveClass("px-3", "py-2");
    expect(filter).not.toHaveClass("text-xs");
  });

  it("switches boards by keyboard and keeps cards per board", async () => {
    const { user } = setup();
    await user.type(screen.getByLabelText("New card title"), "Mine");
    await user.click(screen.getByRole("button", { name: "Add card" }));
    await create(user, "Work");
    expect(screen.queryByText("Mine")).not.toBeInTheDocument();

    await user.tab();
    expect(select()).toHaveFocus();
    await user.selectOptions(select(), "My board");
    expect(selectedName()).toBe("My board");
    expect(screen.getByText("Mine")).toBeInTheDocument();
  });

  describe("create", () => {
    it("shows the character limit and creates an empty current board", async () => {
      const { user } = setup();
      await user.click(screen.getByRole("button", { name: "New board" }));
      expect(screen.getByText(/up to 40 characters/i)).toBeInTheDocument();
      await user.type(screen.getByLabelText("Board name"), "Work");
      await user.click(screen.getByRole("button", { name: "Create" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(selectedName()).toBe("Work");
      expect(screen.getByRole("region", { name: /^To do/ })).toBeInTheDocument();
    });

    it.each([
      ["empty", "   ", /must not be empty/i],
      ["too long", "x".repeat(41), /at most 40/i],
      ["duplicate (case-insensitive)", "MY BOARD", /already exists/i],
    ])("rejects a %s name and adds nothing", async (_label, name, message) => {
      const { user } = setup();
      await user.click(screen.getByRole("button", { name: "New board" }));
      const input = screen.getByLabelText("Board name");
      if (name.trim()) {
        await user.click(input);
        await user.paste(name);
      }
      await user.click(screen.getByRole("button", { name: "Create" }));
      expect(screen.getByRole("alert")).toHaveTextContent(message);
      expect(input).toHaveAttribute("aria-invalid", "true");
      await user.click(screen.getByRole("button", { name: "Cancel" }));
      expect(optionNames()).toEqual(["My board"]);
    });
  });

  describe("rename", () => {
    it("is prefilled and renames the current board", async () => {
      const { user } = setup();
      await user.click(screen.getByRole("button", { name: "Rename board" }));
      const input = screen.getByLabelText("Board name");
      expect(input).toHaveValue("My board");
      await user.clear(input);
      await user.type(input, "Home");
      await user.click(screen.getByRole("button", { name: "Rename" }));
      expect(optionNames()).toEqual(["Home"]);
    });

    it("allows changing only the casing, and rejects duplicates without changing anything", async () => {
      const { user } = setup();
      await create(user, "Work");
      await user.click(screen.getByRole("button", { name: "Rename board" }));
      let input = screen.getByLabelText("Board name");
      await user.clear(input);
      await user.type(input, "my board");
      await user.click(screen.getByRole("button", { name: "Rename" }));
      expect(screen.getByRole("alert")).toHaveTextContent(/already exists/i);
      expect(optionNames()).toEqual(["My board", "Work"]);

      input = screen.getByLabelText("Board name");
      await user.clear(input);
      await user.type(input, "WORK");
      await user.click(screen.getByRole("button", { name: "Rename" }));
      expect(optionNames()).toEqual(["My board", "WORK"]);
    });
  });

  describe("delete", () => {
    it("is disabled for the last board", () => {
      setup();
      expect(screen.getByRole("button", { name: "Delete board" })).toBeDisabled();
    });

    it("keeps the board when cancelled or escaped", async () => {
      const { user } = setup();
      await create(user, "Work");
      await user.click(screen.getByRole("button", { name: "Delete board" }));
      expect(screen.getByRole("dialog")).toHaveTextContent(/delete .work. and all its cards/i);
      await user.click(screen.getByRole("button", { name: "Cancel" }));
      expect(optionNames()).toEqual(["My board", "Work"]);

      await user.click(screen.getByRole("button", { name: "Delete board" }));
      const dialog = screen.getByRole("dialog");
      fireEvent(dialog, createEvent("cancel", dialog, { cancelable: true }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(optionNames()).toEqual(["My board", "Work"]);
    });

    it("removes the board after confirming and makes another current", async () => {
      const { user } = setup();
      await create(user, "Work");
      await user.click(screen.getByRole("button", { name: "Delete board" }));
      await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" }));
      expect(optionNames()).toEqual(["My board"]);
      expect(selectedName()).toBe("My board");
      expect(screen.getByRole("button", { name: "Delete board" })).toBeDisabled();
    });
  });

  it("remembers the last used board", async () => {
    const { user } = setup();
    await create(user, "Work");
    resetBoardStore();
    document.body.innerHTML = "";
    setup();
    expect(selectedName()).toBe("Work");
  });
});
