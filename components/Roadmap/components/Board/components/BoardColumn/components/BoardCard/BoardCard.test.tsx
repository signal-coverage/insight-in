// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { GridList, useDragAndDrop } from "react-aria-components";
import { describe, expect, it, vi } from "vitest";

import type { BoardItem } from "@/core/roadmap/types";

import { BoardCard } from "./BoardCard";

const ITEM: BoardItem = {
  id: "item-1",
  title: "Exportar a CSV",
  description: "Descargar ingresos y gastos del mes",
  status: "IDEA",
  position: 1024,
  createdAt: "2026-10-03",
};

// The same list the board builds: with drag and drop on, which is what gives the handle its name.
function DraggableList() {
  const { dragAndDropHooks } = useDragAndDrop({
    getItems: (keys) => [...keys].map((key) => ({ "text/plain": String(key) })),
  });

  return (
    <GridList aria-label="Ideas" dragAndDropHooks={dragAndDropHooks}>
      <BoardCard
        item={ITEM}
        onMove={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    </GridList>
  );
}

// React Aria words the handle's name in the language of the browser ("Drag ..." here, "Arrastrar ..."
// in Spanish), so the test matches either.
const HANDLE_NAME = /^(Drag|Arrastrar) Exportar a CSV$/;

const renderCard = () => render(<DraggableList />);

describe("BoardCard drag handle", () => {
  it("is there for the keyboard and screen readers, named after the card", () => {
    renderCard();

    expect(
      screen.getByRole("button", { name: HANDLE_NAME }),
    ).toBeInTheDocument();
  });

  it("is not drawn on the card, as the whole card can be picked up with the mouse", () => {
    renderCard();

    expect(screen.getByRole("button", { name: HANDLE_NAME })).toHaveClass(
      "sr-only",
    );
  });

  it("shows itself while it has the keyboard focus, so nobody tabs onto something unseen", () => {
    renderCard();

    expect(screen.getByRole("button", { name: HANDLE_NAME })).toHaveClass(
      "focus-visible:not-sr-only",
    );
  });
});
