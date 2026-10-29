import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { emptyBoard, insightsListIds, MAX_WIP_LIMIT, setWipLimit } from "@/lib/board";
import type { Board } from "@/lib/board";
import { SettingsPanel } from "@/components/panels/SettingsPanel";

function Harness({ initial, onClose }: { initial: Board; onClose: () => void }) {
  const [board, setBoard] = useState(initial);
  return (
    <>
      <SettingsPanel board={board} onClose={onClose} onUpdateBoard={(change) => setBoard(change)} />
      <output data-testid="board">{JSON.stringify({ ids: insightsListIds(board), wip: board.wipLimits ?? {} })}</output>
    </>
  );
}

function renderPanel(board: Board = emptyBoard()) {
  const onClose = vi.fn();
  render(<Harness initial={board} onClose={onClose} />);
  return { onClose };
}

function state() {
  return JSON.parse(screen.getByTestId("board").textContent ?? "{}") as {
    ids: { doing?: string; done?: string };
    wip: Record<string, number>;
  };
}

describe("<SettingsPanel />", () => {
  it("is a dialog titled Settings that closes with the Close button", async () => {
    const { onClose } = renderPanel();
    expect(screen.getByRole("dialog", { name: "Settings" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("has an Import / Export section with Export and Import buttons", () => {
    renderPanel();
    const section = screen.getByRole("region", { name: "Import / Export" });
    expect(within(section).getByRole("button", { name: "Export" })).toBeInTheDocument();
    expect(within(section).getByRole("button", { name: "Import" })).toBeInTheDocument();
    expect(within(section).getByLabelText("Import board file")).toBeInTheDocument();
  });

  it("shows an error for an invalid import file inside the dialog", async () => {
    renderPanel();
    const file = new File(['{"hello":"world"}'], "other.json", { type: "application/json" });
    await userEvent.upload(screen.getByLabelText("Import board file"), file);
    const dialog = screen.getByRole("dialog", { name: "Settings" });
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(/not a Kanban board/);
  });

  it("sets and unsets the done and in progress lists", async () => {
    renderPanel();
    await userEvent.selectOptions(screen.getByLabelText("Done list"), "Doing");
    expect(state().ids.done).toBe("doing");
    expect(screen.getByText(/used for insights, archiving and overdue/)).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("Done list"), "Not set");
    expect(state().ids.done).toBeUndefined();
  });

  it("hints when a list is not set", async () => {
    renderPanel();
    expect(screen.queryByText(/Pick the lists that mean/)).not.toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("Done list"), "Not set");
    expect(screen.getByText(/Pick the lists that mean in progress and done/)).toBeInTheDocument();
  });

  it("shows the current WIP limit of each list", () => {
    renderPanel(setWipLimit(emptyBoard(), "doing", 3));
    expect(screen.getByLabelText("WIP limit for Doing")).toHaveValue("3");
    expect(screen.getByText("Limit 3")).toBeInTheDocument();
    expect(screen.getByLabelText("WIP limit for To do")).toHaveValue("");
  });

  it("saves and clears a WIP limit", async () => {
    renderPanel();
    await userEvent.type(screen.getByLabelText("WIP limit for Doing"), "4{Enter}");
    expect(state().wip).toEqual({ doing: 4 });
    expect(screen.getByText("Limit 4")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Clear WIP limit for Doing" }));
    expect(state().wip).toEqual({});
    expect(screen.getByLabelText("WIP limit for Doing")).toHaveValue("");
  });

  it.each(["0", "abc", String(MAX_WIP_LIMIT + 1)])("rejects the WIP limit %s", async (value) => {
    renderPanel();
    await userEvent.type(screen.getByLabelText("WIP limit for Doing"), `${value}{Enter}`);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(state().wip).toEqual({});
  });
});
