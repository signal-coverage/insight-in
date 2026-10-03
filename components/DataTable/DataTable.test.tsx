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
      label="People"
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
  it("is a HeroUI table (a grid) named after its label", () => {
    renderTable();

    expect(screen.getByRole("grid", { name: "People" })).toHaveAttribute(
      "data-slot",
      "table-content",
    );
  });

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
    expect(
      screen.getByRole("rowheader", { name: "Grace" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("gridcell", { name: "Maintainer" }),
    ).toBeInTheDocument();
  });

  it("reads the first column as the row header unless another one says so", () => {
    const { unmount } = renderTable();

    expect(screen.getAllByRole("rowheader").map((c) => c.textContent)).toEqual([
      "Ada",
      "Grace",
      "Linus",
    ]);

    unmount();
    renderTable({
      columns: [COLUMNS[0], { ...COLUMNS[1], isRowHeader: true }],
    });

    expect(screen.getAllByRole("rowheader").map((c) => c.textContent)).toEqual([
      "Engineer",
      "Admiral",
      "Maintainer",
    ]);
  });

  it("applies column and header class names", () => {
    renderTable();

    expect(screen.getByRole("columnheader", { name: "Role" })).toHaveClass(
      "head-role",
    );
    expect(screen.getByRole("gridcell", { name: "Engineer" })).toHaveClass(
      "cell-role",
    );
  });

  it("puts the className on the bordered wrapper", () => {
    const { container } = renderTable({ className: "flex-1 custom-wrapper" });

    expect(container.firstElementChild).toHaveClass(
      "custom-wrapper",
      "flex-1",
      "rounded-2xl",
      "border",
    );
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
    expect(screen.queryByRole("grid")).not.toBeInTheDocument();
  });
});

describe("DataTable loading state", () => {
  it("announces the loading label and hides the table from assistive tech", () => {
    renderTable({ isLoading: true });

    const hidden = screen.getByRole("grid", { hidden: true });

    expect(screen.getByRole("status")).toHaveTextContent("Loading people");
    expect(hidden.closest("[aria-hidden='true']")).not.toBeNull();
    // The announcement itself stays reachable.
    expect(screen.getByRole("status").closest("[aria-hidden]")).toBeNull();
  });

  it("takes the skeleton table out of the tab order", () => {
    renderTable({ isLoading: true });

    expect(
      screen.getByRole("grid", { hidden: true }).closest("[inert]"),
    ).not.toBeNull();
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

  it("draws a HeroUI skeleton in a column without a loadingCell", () => {
    const { container } = renderTable({ isLoading: true, loadingRowCount: 1 });

    expect(container.querySelectorAll(".skeleton")).toHaveLength(2);
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
  it("does not make rows pressable without onRowClick", () => {
    renderTable();

    bodyRows().forEach((row) => {
      expect(row).not.toHaveClass("cursor-pointer");
    });
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("gives rows the pointer cursor when onRowClick is set", () => {
    renderTable({ onRowClick: vi.fn() });

    const rows = bodyRows();

    expect(rows).toHaveLength(3);
    rows.forEach((row) => expect(row).toHaveClass("cursor-pointer"));
  });

  it("calls onRowClick with the clicked row's item", () => {
    const onRowClick = vi.fn();

    renderTable({ onRowClick });
    fireEvent.click(screen.getByRole("rowheader", { name: "Grace" }));

    expect(onRowClick).toHaveBeenCalledTimes(1);
    expect(onRowClick).toHaveBeenCalledWith(PEOPLE[1]);
  });

  it.each([
    ["Enter", "Enter"],
    ["Space", " "],
  ])("activates a row with the %s key", (_label, key) => {
    const onRowClick = vi.fn();

    renderTable({ onRowClick });

    const row = bodyRows()[2];

    fireEvent.keyDown(row, { key });
    fireEvent.keyUp(row, { key });

    expect(onRowClick).toHaveBeenCalledTimes(1);
    expect(onRowClick).toHaveBeenCalledWith(PEOPLE[2]);
  });

  it("ignores other keys", () => {
    const onRowClick = vi.fn();

    renderTable({ onRowClick });

    const row = bodyRows()[0];

    fireEvent.keyDown(row, { key: "a" });
    fireEvent.keyUp(row, { key: "a" });

    expect(onRowClick).not.toHaveBeenCalled();
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

describe("DataTable row notes", () => {
  it("adds a full-width row right under the row that has a note", () => {
    renderTable({
      rowNote: (person) =>
        person.id === "2" ? <p>Careful with Grace</p> : null,
    });

    const rows = bodyRows();

    expect(rows).toHaveLength(4);
    expect(rows[1]).toHaveTextContent("Grace");
    expect(rows[2]).toHaveTextContent("Careful with Grace");
    expect(rows[3]).toHaveTextContent("Linus");
    expect(rows[2].querySelector("td")).toHaveAttribute("colspan", "2");
  });

  it("wraps a long note inside the width the columns already give, instead of widening the whole table", () => {
    renderTable({
      rowNote: (person) =>
        person.id === "2" ? <p>A very long note about Grace</p> : null,
    });

    const wrapper = bodyRows()[2].querySelector("td")?.firstElementChild;

    // Zero intrinsic width, but never narrower than the cell: the text wraps in the cell's width.
    expect(wrapper).toHaveClass("w-0", "min-w-full", "whitespace-normal");
  });

  it("adds nothing for rows without a note, or without rowNote at all", () => {
    renderTable({ rowNote: () => null });
    expect(bodyRows()).toHaveLength(3);
  });

  it("keeps a row's note under it when the rows change", () => {
    const { rerender } = renderTable({
      rowNote: (person) => (person.id === "1" ? <p>Note for Ada</p> : null),
    });

    expect(bodyRows()[1]).toHaveTextContent("Note for Ada");

    rerender(
      <DataTable
        label="People"
        columns={COLUMNS}
        rows={[PEOPLE[1], PEOPLE[0]]}
        rowKey={(person) => person.id}
        isLoading={false}
        loadingLabel="Loading people"
        emptyState={<p>Nobody here</p>}
        rowNote={(person) => (person.id === "1" ? <p>Note for Ada</p> : null)}
      />,
    );

    const rows = bodyRows();

    expect(rows[0]).toHaveTextContent("Grace");
    expect(rows[1]).toHaveTextContent("Ada");
    expect(rows[2]).toHaveTextContent("Note for Ada");
  });
});
