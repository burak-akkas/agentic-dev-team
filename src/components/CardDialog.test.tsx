import { createEvent, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MAX_LABEL_LENGTH, MAX_NOTES_LENGTH, type Card } from "@/lib/board";
import { CardDialog } from "./CardDialog";

const card: Card = {
  id: "a",
  title: "Write docs",
  createdAt: "2030-01-01T10:00:00.000Z",
  priority: "medium",
  notes: "Some notes",
  dueDate: "2030-02-03",
};

function setup(overrides: Partial<Card> = {}) {
  const onSave = vi.fn();
  const onDelete = vi.fn();
  const onClose = vi.fn();
  render(<CardDialog card={{ ...card, ...overrides }} column="todo" onSave={onSave} onDelete={onDelete} onClose={onClose} />);
  return { onSave, onDelete, onClose, user: userEvent.setup() };
}

afterEach(() => vi.restoreAllMocks());

describe("<CardDialog />", () => {
  it("is a dialog named by the card title with a heading", () => {
    setup();
    const dialog = screen.getByRole("dialog", { name: "Write docs" });
    expect(dialog).toHaveAttribute("open");
    expect(screen.getByRole("heading", { name: "Write docs" })).toBeInTheDocument();
  });

  it("prefills the fields and shows the created date read-only", () => {
    setup();
    expect(screen.getByLabelText("Title")).toHaveValue("Write docs");
    expect(screen.getByLabelText("Description")).toHaveValue("Some notes");
    expect(screen.getByLabelText("Status")).toHaveValue("todo");
    expect(screen.getByLabelText("Priority")).toHaveValue("medium");
    expect(screen.getByLabelText("Due date")).toHaveValue("2030-02-03");
    expect(screen.getByText(/^Created/).querySelector("time")).toHaveAttribute("datetime", card.createdAt);
  });

  it("shows an error and blocks Save for an empty title", async () => {
    const { user, onSave } = setup();
    await user.clear(screen.getByLabelText("Title"));
    expect(screen.getByRole("alert")).toHaveTextContent("Title must not be empty");
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    await user.keyboard("{Enter}");
    expect(onSave).not.toHaveBeenCalled();
  });

  it("limits the description length", () => {
    setup();
    expect(screen.getByLabelText("Description")).toHaveAttribute("maxlength", String(MAX_NOTES_LENGTH));
  });

  it("clears the due date", async () => {
    const { user, onSave } = setup();
    await user.click(screen.getByRole("button", { name: "Clear due date" }));
    expect(screen.getByLabelText("Due date")).toHaveValue("");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ dueDate: undefined }));
  });

  it("saves all edits at once", async () => {
    const { user, onSave } = setup();
    await user.clear(screen.getByLabelText("Title"));
    await user.type(screen.getByLabelText("Title"), "Ship docs");
    await user.clear(screen.getByLabelText("Description"));
    await user.selectOptions(screen.getByLabelText("Status"), "doing");
    await user.selectOptions(screen.getByLabelText("Priority"), "high");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith({
      title: "Ship docs",
      notes: undefined,
      priority: "high",
      dueDate: "2030-02-03",
      column: "doing",
      labels: [],
    });
  });

  it("adds labels with the keyboard, rejects bad input with a visible message and removes labels", async () => {
    const { user, onSave } = setup({ labels: ["Bug"] });
    expect(screen.getByRole("button", { name: "Remove label Bug" })).toBeInTheDocument();

    const input = screen.getByLabelText("Labels");
    await user.type(input, "  design {Enter}");
    expect(onSave).not.toHaveBeenCalled();
    expect(input).toHaveValue("");
    expect(screen.getByRole("button", { name: "Remove label design" })).toBeInTheDocument();

    await user.type(input, "BUG{Enter}");
    expect(screen.getByRole("alert")).toHaveTextContent("already exists");

    await user.clear(input);
    await user.type(input, "   {Enter}");
    expect(screen.getByRole("alert")).toHaveTextContent("must not be empty");

    await user.type(input, "x".repeat(MAX_LABEL_LENGTH + 1));
    await user.click(screen.getByRole("button", { name: "Add label" }));
    expect(screen.getByRole("alert")).toHaveTextContent(`at most ${MAX_LABEL_LENGTH} characters`);

    await user.click(screen.getByRole("button", { name: "Remove label Bug" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ labels: ["design"] }));
  });

  it("asks before discarding when only labels changed", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { user, onClose } = setup();
    await user.type(screen.getByLabelText("Labels"), "bug{Enter}");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes without asking when Cancel is used with no changes", async () => {
    const confirm = vi.spyOn(window, "confirm");
    const { user, onClose } = setup();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(confirm).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("asks before discarding changes and honours the answer", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    const { user, onClose } = setup();
    await user.type(screen.getByLabelText("Title"), "!");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("routes Escape (cancel event) through the same close logic", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { onClose } = setup();
    const dialog = screen.getByRole("dialog");
    const event = createEvent("cancel", dialog, { cancelable: true });
    fireEvent(dialog, event);
    expect(event.defaultPrevented).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(confirm).not.toHaveBeenCalled();
  });

  it("confirms Escape and backdrop closes when dirty", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { user, onClose } = setup();
    await user.type(screen.getByLabelText("Title"), "!");
    const dialog = screen.getByRole("dialog");
    fireEvent(dialog, createEvent("cancel", dialog, { cancelable: true }));
    await user.click(dialog);
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes on a backdrop click but not on a click inside the dialog", async () => {
    const { user, onClose } = setup();
    await user.click(screen.getByLabelText("Title"));
    expect(onClose).not.toHaveBeenCalled();
    await user.click(screen.getByRole("dialog"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("deletes only after confirmation", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    const { user, onDelete } = setup();
    await user.click(screen.getByRole("button", { name: "Delete card" }));
    expect(onDelete).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Delete card" }));
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
