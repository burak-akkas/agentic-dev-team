import { BoardSwitcher } from "@/components/app/BoardSwitcher";
import { BoardTransfer } from "@/components/app/BoardTransfer";
import { BoardUrlSync } from "@/components/app/BoardUrlSync";
import { KeyboardShortcuts } from "@/components/app/KeyboardShortcuts";
import { ThemeSync } from "@/components/app/ThemeSync";
import { Board } from "@/components/board/Board";

export default function Home() {
  return (
    <main className="flex w-full min-w-0 flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Kanban</h1>
          <p className="mt-1 text-sm text-zinc-500">
            A small board built and maintained by an autonomous agent team. Your cards are saved in this browser.
          </p>
          <BoardSwitcher />
          <BoardUrlSync />
          <ThemeSync />
        </div>
        <div className="flex flex-col items-start gap-3 sm:items-end">
          <BoardTransfer />
          <KeyboardShortcuts />
        </div>
      </header>
      <Board />
    </main>
  );
}
