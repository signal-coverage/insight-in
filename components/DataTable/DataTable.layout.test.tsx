// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DataTable } from "./DataTable";
import type { DataTableColumn } from "./types";

type Row = { id: string; name: string; note: string };

const COLUMNS: DataTableColumn<Row>[] = [
  { key: "name", header: "Name", className: "w-40", cell: (row) => row.name },
  { key: "note", header: "Note", cell: (row) => row.note },
];

const ROWS: Row[] = [
  {
    id: "1",
    name: "Ada",
    note: "A very long note that would otherwise widen its column",
  },
];

const renderTable = (isLoading: boolean, tableClassName?: string) =>
  render(
    <DataTable<Row>
      label="Rows"
      columns={COLUMNS}
      rows={ROWS}
      rowKey={(row) => row.id}
      isLoading={isLoading}
      loadingLabel="Loading"
      emptyState={<p>empty</p>}
      tableClassName={tableClassName}
    />,
  );

const table = () => screen.getByRole("grid", { hidden: true });
const headerClasses = () =>
  screen
    .getAllByRole("columnheader", { hidden: true })
    .map((header) => header.className);
const firstRowCellClasses = () =>
  Array.from(
    screen
      .getAllByRole("rowgroup", { hidden: true })[1]
      .querySelectorAll("tr:first-child > td"),
  ).map((cell) => cell.className);

describe("DataTable layout", () => {
  it("gives the table the classes it is given, loaded or loading", () => {
    const loaded = renderTable(false, "table-fixed min-w-[40rem]");

    expect(table()).toHaveClass("table-fixed", "min-w-[40rem]");

    loaded.unmount();
    renderTable(true, "table-fixed min-w-[40rem]");

    expect(table()).toHaveClass("table-fixed", "min-w-[40rem]");
  });

  it("keeps the edge padding next to the classes it is given", () => {
    renderTable(false, "table-fixed");

    expect(table().className).toContain("[&_th:first-child]:pl-4");
  });

  it("gives every column the same classes while loading and once loaded, so widths never jump", () => {
    const loaded = renderTable(false, "table-fixed");
    const loadedHeaders = headerClasses();
    const loadedCells = firstRowCellClasses();
    const loadedTable = table().className;

    loaded.unmount();
    renderTable(true, "table-fixed");

    expect(headerClasses()).toEqual(loadedHeaders);
    expect(firstRowCellClasses()).toEqual(loadedCells);
    expect(table().className).toBe(loadedTable);
  });

  it("applies a column's width class to its header and to its cells", () => {
    renderTable(false, "table-fixed");

    expect(screen.getByRole("columnheader", { name: "Name" })).toHaveClass(
      "w-40",
    );
    expect(screen.getByRole("rowheader", { name: "Ada" })).toHaveClass("w-40");
  });

  it("scrolls inside the bordered box without outgrowing it", () => {
    const { container } = renderTable(false, "table-fixed");

    expect(container.firstElementChild).toHaveClass(
      "flex",
      "flex-col",
      "overflow-hidden",
      "rounded-2xl",
      "border",
      "bg-surface",
    );
    expect(
      container.querySelector('[data-slot="table-scroll-container"]'),
    ).toHaveClass("overflow-auto", "min-h-0", "flex-1");
  });

  it("keeps the app's header height and cell padding on top of HeroUI's", () => {
    renderTable(false, "table-fixed");

    expect(screen.getByRole("columnheader", { name: "Name" })).toHaveClass(
      "h-10",
      "px-2",
    );
    expect(
      screen.getByRole("gridcell", { name: /very long note/ }),
    ).toHaveClass("p-2", "whitespace-nowrap");
  });

  it("hints at more table to scroll to with an edge fade on each side that has more", () => {
    const { container } = renderTable(false, "table-fixed");

    const area = container.querySelector(
      '[data-slot="table-scroll-container"]',
    ) as HTMLElement;
    const [left, right] = Array.from(
      area.parentElement!.querySelectorAll<HTMLElement>(
        ':scope > [aria-hidden="true"]',
      ),
    );

    // Nothing to scroll in jsdom's empty layout: both fades are off.
    expect(left.style.opacity).toBe("0");
    expect(right.style.opacity).toBe("0");

    // Wider content than the area, scrolled to the start: more to the right only.
    Object.defineProperty(area, "scrollWidth", {
      configurable: true,
      value: 1000,
    });
    Object.defineProperty(area, "clientWidth", {
      configurable: true,
      value: 500,
    });
    fireEvent.scroll(area);

    expect(left.style.opacity).toBe("0");
    expect(right.style.opacity).toBe("1");

    // Scrolled somewhere in the middle: more on both sides.
    area.scrollLeft = 100;
    fireEvent.scroll(area);

    expect(left.style.opacity).toBe("1");
    expect(right.style.opacity).toBe("1");

    // Scrolled to the end: more to the left only.
    area.scrollLeft = 500;
    fireEvent.scroll(area);

    expect(left.style.opacity).toBe("1");
    expect(right.style.opacity).toBe("0");
  });

  it("draws no edge fades while loading", () => {
    const { container } = renderTable(true, "table-fixed");

    expect(container.querySelectorAll(".pointer-events-none")).toHaveLength(0);
  });
});
