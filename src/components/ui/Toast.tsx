import type { ReactNode } from "react";

export function Toast({ children }: { children: ReactNode }) {
  return (
    <div
      role="status"
      className="fixed bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-3 rounded-lg bg-inverse px-4 py-2 text-sm text-on-inverse shadow-lg"
    >
      {children}
    </div>
  );
}
