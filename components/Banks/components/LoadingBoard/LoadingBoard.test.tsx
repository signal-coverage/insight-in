// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LoadingBoard } from "./LoadingBoard";

const STATUS_NAME = "Cargando bancos y cuentas";

// The skeleton rows of the banks, without the full-width row that closes the board.
const rowsOf = (board: HTMLElement) => Array.from(board.children).slice(0, -1);

describe("LoadingBoard", () => {
  it("announces that the banks are loading", () => {
    render(<LoadingBoard />);

    expect(screen.getByRole("status", { name: STATUS_NAME })).toHaveAttribute(
      "aria-busy",
      "true",
    );
  });

  it("shows skeleton rows shaped like the real ones, and no buttons: nothing can be pressed while there is no data", () => {
    render(<LoadingBoard />);

    const board = screen.getByRole("status", { name: STATUS_NAME });

    // The check below would be vacuous on an empty board, so first prove the rows really are there:
    // 3 rows, each the sticky column (one card skeleton) and the account area (2, 3 and 1 cards).
    expect(rowsOf(board)).toHaveLength(3);
    expect(rowsOf(board).map((row) => row.children.length)).toEqual([2, 2, 2]);
    expect(rowsOf(board).map((row) => row.children[1].children.length)).toEqual(
      [2, 3, 1],
    );
    expect(board.querySelectorAll(".skeleton")).toHaveLength(10);

    expect(screen.queryAllByRole("button")).toEqual([]);
  });

  it("scrolls like the real board, so nothing shifts when it arrives", () => {
    render(<LoadingBoard />);

    expect(screen.getByRole("status", { name: STATUS_NAME })).toHaveClass(
      "overflow-auto",
    );
  });

  it("ends with one full-width skeleton row standing for '+ Nuevo banco', and no filler", () => {
    render(<LoadingBoard />);

    const board = screen.getByRole("status", { name: STATUS_NAME });
    const last = board.lastElementChild as HTMLElement;

    expect(board.children).toHaveLength(4);
    expect(board.querySelector("[aria-hidden='true']")).toBeNull();
    expect(board.getAttribute("style")).toBeNull();
    expect(last.children).toHaveLength(1);
    expect(last.firstElementChild).toHaveClass(
      "sticky",
      "left-0",
      "w-[100cqw]",
      "p-3",
    );
    expect(last.querySelectorAll(".skeleton")).toHaveLength(1);
    expect(last.querySelector(".skeleton")).toHaveClass(
      "min-h-24",
      "rounded-2xl",
      "w-full",
    );
    expect(board).toHaveClass("@container");
  });

  it("fills the height like the real board, rows at the top", () => {
    render(<LoadingBoard />);

    expect(screen.getByRole("status", { name: STATUS_NAME })).toHaveClass(
      "flex-1",
      "min-h-64",
      "content-start",
    );
  });

  it("is the same bordered, rounded container as the real board, with a line between rows", () => {
    render(<LoadingBoard />);

    const board = screen.getByRole("status", { name: STATUS_NAME });

    expect(board).toHaveClass(
      "rounded-2xl",
      "border",
      "border-border",
      "bg-surface",
      "divide-y",
      "divide-border",
      "grid-cols-[minmax(max-content,1fr)]",
    );
    for (const row of rowsOf(board)) {
      expect(row).toHaveClass("min-h-30");
      expect(row.className).not.toMatch(/(^|\s)gap-/);
    }
  });

  it("mirrors the card layout: the vertical line after the sticky column, cards with a gap in the row", () => {
    render(<LoadingBoard />);

    const board = screen.getByRole("status", { name: STATUS_NAME });

    for (const row of rowsOf(board)) {
      const [column, cards] = Array.from(row.children);

      expect(column).toHaveClass(
        "border-r",
        "border-border",
        "bg-surface",
        "p-3",
      );
      expect(column.className).not.toMatch(/(^|\s)border(\s|$)/);
      expect(cards).toHaveClass("flex", "gap-3", "p-3");
      expect(cards.className).not.toMatch(/(^|\s)(border|border-\S+)(\s|$)/);
    }
  });

  it("draws card-shaped skeletons: the bank card and the account cards, all the same height", () => {
    render(<LoadingBoard />);

    const board = screen.getByRole("status", { name: STATUS_NAME });
    const skeletons = Array.from(board.querySelectorAll(".skeleton"));

    expect(skeletons).toHaveLength(10);
    for (const skeleton of skeletons) {
      expect(skeleton).toHaveClass("rounded-2xl", "min-h-24");
    }
  });

  it("draws the first-column skeleton at the width of the real cell on a phone and from sm up", () => {
    render(<LoadingBoard />);

    const board = screen.getByRole("status", { name: STATUS_NAME });
    const cellSkeleton = rowsOf(board)[0].children[0];

    expect(cellSkeleton).toHaveClass("w-36", "sm:w-52");
  });
});
