// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DataTable } from "./DataTable";
import type { DataTableColumn } from "./types";

interface Person {
  id: string;
  name: string;
  role: string;
}

const PEOPLE: Person[] = [
  { id: "1", name: "Ada", role: "Engineer" },
  { id: "2", name: "Grace", role: "Admiral" },
  { id: "3", name: "Linus", role: "Maintainer" },
];

const COLUMNS: DataTableColumn<Person>[] = [
  { key: "name", header: "Name", cell: (person) => person.name },
  {
    key: "role",
    header: "Role",
    className: "cell-role",
    headerClassName: "head-role",
    cell: (person) => person.role,
  },
];

const renderTable = (
  props: Partial<React.ComponentProps<typeof DataTable<Person>>> = {},
) =>
  render(
    <DataTable
      columns={COLUMNS}
      rows={PEOPLE}
      rowKey={(person) => person.id}
      isLoading={false}
      loadingLabel="Loading people"
      emptyState={<p>Nobody here</p>}
      {...props}
    />,
  );

const bodyRows = () =>
  within(screen.getAllByRole("rowgroup")[1]).getAllByRole("row");

describe("DataTable rows", () => {
  it("renders a header cell per column", () => {
    renderTable();

    expect(
      screen.getByRole("columnheader", { name: "Name" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Role" }),
    ).toBeInTheDocument();
  });

  it("renders one body row per item using the column cell renderers", () => {
    renderTable();

    expect(bodyRows()).toHaveLength(3);
    expect(screen.getByRole("cell", { name: "Grace" })).toBeInTheDocument();
    expect(
      screen.getByRole("cell", { name: "Maintainer" }),
    ).toBeInTheDocument();
  });

  it("applies column and header class names", () => {
    renderTable();

    expect(screen.getByRole("columnheader", { name: "Role" })).toHaveClass(
      "head-role",
    );
    expect(screen.getByRole("cell", { name: "Engineer" })).toHaveClass(
      "cell-role",
    );
  });

  it("puts the className on the bordered wrapper", () => {
    const { container } = renderTable({ className: "flex-1 custom-wrapper" });

    expect(container.firstElementChild).toHaveClass("custom-wrapper", "flex-1");
  });

  it("does not render the empty state when there are rows", () => {
    renderTable();

    expect(screen.queryByText("Nobody here")).not.toBeInTheDocument();
  });
});

describe("DataTable empty state", () => {
  it("renders the empty state instead of a table when there are no rows", () => {
    renderTable({ rows: [] });

    expect(screen.getByText("Nobody here")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});

describe("DataTable loading state", () => {
  it("announces the loading label and hides the table from assistive tech", () => {
    renderTable({ isLoading: true });

    expect(screen.getByRole("status")).toHaveTextContent("Loading people");
    expect(screen.getByRole("table", { hidden: true })).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("renders the default number of placeholder rows and no data", () => {
    renderTable({ isLoading: true });

    expect(
      within(screen.getAllByRole("rowgroup", { hidden: true })[1]).getAllByRole(
        "row",
        { hidden: true },
      ),
    ).toHaveLength(5);
    expect(screen.queryByText("Ada")).not.toBeInTheDocument();
  });

  it("honours loadingRowCount", () => {
    renderTable({ isLoading: true, loadingRowCount: 2 });

    expect(
      within(screen.getAllByRole("rowgroup", { hidden: true })[1]).getAllByRole(
        "row",
        { hidden: true },
      ),
    ).toHaveLength(2);
  });

  it("uses a column's loadingCell when provided", () => {
    const columns: DataTableColumn<Person>[] = [
      { ...COLUMNS[0], loadingCell: <span data-testid="custom-loading" /> },
      COLUMNS[1],
    ];

    renderTable({ isLoading: true, loadingRowCount: 2, columns });

    expect(screen.getAllByTestId("custom-loading")).toHaveLength(2);
  });

  it("shows the loading state rather than the empty state", () => {
    renderTable({ isLoading: true, rows: [] });

    expect(screen.queryByText("Nobody here")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("still renders the column headers while loading", () => {
    renderTable({ isLoading: true });

    expect(
      screen.getByRole("columnheader", { name: "Name", hidden: true }),
    ).toBeInTheDocument();
  });
});

describe("DataTable row interaction", () => {
  it("does not make rows interactive without onRowClick", () => {
    renderTable();

    bodyRows().forEach((row) => {
      expect(row).not.toHaveAttribute("tabindex");
    });
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("makes rows focusable buttons when onRowClick is set", () => {
    renderTable({ onRowClick: vi.fn() });

    const rows = screen.getAllByRole("button");

    expect(rows).toHaveLength(3);
    rows.forEach((row) => expect(row).toHaveAttribute("tabindex", "0"));
  });

  it("calls onRowClick with the clicked row's item", () => {
    const onRowClick = vi.fn();

    renderTable({ onRowClick });
    fireEvent.click(screen.getByRole("cell", { name: "Grace" }));

    expect(onRowClick).toHaveBeenCalledTimes(1);
    expect(onRowClick).toHaveBeenCalledWith(PEOPLE[1]);
  });

  it.each([
    ["Enter", "Enter"],
    ["Space", " "],
  ])("activates a row with the %s key", (_label, key) => {
    const onRowClick = vi.fn();

    renderTable({ onRowClick });

    const notPrevented = fireEvent.keyDown(screen.getAllByRole("button")[2], {
      key,
    });

    expect(onRowClick).toHaveBeenCalledWith(PEOPLE[2]);
    expect(notPrevented).toBe(false);
  });

  it("ignores other keys", () => {
    const onRowClick = vi.fn();

    renderTable({ onRowClick });

    const notPrevented = fireEvent.keyDown(screen.getAllByRole("button")[0], {
      key: "a",
    });

    expect(onRowClick).not.toHaveBeenCalled();
    expect(notPrevented).toBe(true);
  });
});

describe("DataTable selection", () => {
  it("marks only the selected rows with data-state=selected", () => {
    renderTable({ isRowSelected: (person) => person.id === "2" });

    const rows = bodyRows();

    expect(rows[0]).not.toHaveAttribute("data-state");
    expect(rows[1]).toHaveAttribute("data-state", "selected");
    expect(rows[2]).not.toHaveAttribute("data-state");
  });

  it("leaves rows unmarked without isRowSelected", () => {
    renderTable();

    bodyRows().forEach((row) => expect(row).not.toHaveAttribute("data-state"));
  });
});
