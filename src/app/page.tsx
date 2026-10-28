import { Board } from "@/components/Board";
import { BoardTransfer } from "@/components/BoardTransfer";
import { KeyboardShortcuts } from "@/components/KeyboardShortcuts";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Kanban</h1>
          <p className="mt-1 text-sm text-zinc-500">
            A small board built and maintained by an autonomous agent team. Your cards are saved in this browser.
          </p>
        </div>
        <div className="flex flex-col items-start gap-3 sm:items-end">
          <ThemeToggle />
          <BoardTransfer />
          <KeyboardShortcuts />
        </div>
      </header>
      <Board />
    </main>
  );
}
