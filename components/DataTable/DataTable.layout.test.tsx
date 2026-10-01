// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
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
      columns={COLUMNS}
      rows={ROWS}
      rowKey={(row) => row.id}
      isLoading={isLoading}
      loadingLabel="Loading"
      emptyState={<p>empty</p>}
      tableClassName={tableClassName}
    />,
  );

const table = () => screen.getByRole("table", { hidden: true });
const headerClasses = () =>
  screen
    .getAllByRole("columnheader", { hidden: true })
    .map((header) => header.className);

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
    const loadedClasses = headerClasses();
    const loadedTable = table().className;

    loaded.unmount();
    renderTable(true, "table-fixed");

    expect(headerClasses()).toEqual(loadedClasses);
    expect(table().className).toBe(loadedTable);
  });

  it("applies a column's width class to its header and to its cells", () => {
    renderTable(false, "table-fixed");

    expect(screen.getByRole("columnheader", { name: "Name" })).toHaveClass(
      "w-40",
    );
    expect(screen.getByRole("cell", { name: "Ada" })).toHaveClass("w-40");
  });
});
