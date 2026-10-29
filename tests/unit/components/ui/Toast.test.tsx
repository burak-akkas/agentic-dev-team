import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Surface } from "@/components/ui/Surface";
import { Toast } from "@/components/ui/Toast";

describe("<Toast />", () => {
  it("is a status region with its children", () => {
    render(
      <Toast>
        <span>Archived 2 cards</span>
      </Toast>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Archived 2 cards");
  });
});

describe("<Surface />", () => {
  it("is a named region on the surface color and merges className", () => {
    render(
      <Surface aria-label="Panel" className="text-sm">
        Content
      </Surface>,
    );
    expect(screen.getByRole("region", { name: "Panel" })).toHaveClass("bg-surface", "border-line", "text-sm");
  });
});
