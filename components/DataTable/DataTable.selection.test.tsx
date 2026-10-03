// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DataTable } from "./DataTable";
import type { DataTableColumn, DataTableProps } from "./types";

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
  { key: "name", header: "Name", className: "w-40", cell: (p) => p.name },
  { key: "role", header: "Role", cell: (p) => p.role },
];

const SELECT_ALL = "Seleccionar todas las filas";

const renderTable = (
  props: Partial<DataTableProps<Person>> = {},
  selectedKeys: ReadonlySet<string> = new Set(),
  onSelectionChange: (keys: ReadonlySet<string>) => void = vi.fn(),
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
      selection={{
        selectedKeys,
        onSelectionChange,
        selectAllLabel: SELECT_ALL,
        rowLabel: (person) => `Seleccionar ${person.name}`,
      }}
      {...props}
    />,
  );

const bodyRows = () =>
  within(screen.getAllByRole("rowgroup")[1]).getAllByRole("row");

describe("DataTable with selection", () => {
  it("puts a checkbox column before every other one, named after the page and each row", () => {
    renderTable();

    const headers = screen.getAllByRole("columnheader");

    expect(headers).toHaveLength(3);
    expect(
      within(headers[0]).getByRole("checkbox", { name: SELECT_ALL }),
    ).toBeInTheDocument();
    expect(headers[1]).toHaveTextContent("Name");
    ["Ada", "Grace", "Linus"].forEach((name) =>
      expect(
        screen.getByRole("checkbox", { name: `Seleccionar ${name}` }),
      ).toBeInTheDocument(),
    );
  });

  it("adds nothing without a selection", () => {
    renderTable({ selection: undefined });

    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.getAllByRole("columnheader")).toHaveLength(2);
  });

  it("keeps the row header on the column that names the row, not on the checkbox", () => {
    renderTable();

    expect(screen.getAllByRole("rowheader").map((c) => c.textContent)).toEqual([
      "Ada",
      "Grace",
      "Linus",
    ]);
  });

  it("shows the checkboxes of the selected rows ticked and the others not", () => {
    renderTable({}, new Set(["2"]));

    expect(
      screen.getByRole("checkbox", { name: "Seleccionar Ada" }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Seleccionar Grace" }),
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Seleccionar Linus" }),
    ).not.toBeChecked();
    expect(bodyRows()[1]).toHaveAttribute("aria-selected", "true");
  });

  it("reports the keys when a row is ticked", () => {
    const onSelectionChange = vi.fn();

    renderTable({}, new Set(["1"]), onSelectionChange);
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Seleccionar Linus" }),
    );

    expect(onSelectionChange).toHaveBeenCalledTimes(1);
    expect(onSelectionChange.mock.calls[0][0]).toEqual(new Set(["1", "3"]));
  });

  it("reports the keys without a row when it is unticked", () => {
    const onSelectionChange = vi.fn();

    renderTable({}, new Set(["1", "3"]), onSelectionChange);
    fireEvent.click(screen.getByRole("checkbox", { name: "Seleccionar Ada" }));

    expect(onSelectionChange.mock.calls[0][0]).toEqual(new Set(["3"]));
  });

  it("selects every row of the page from the header checkbox", () => {
    const onSelectionChange = vi.fn();

    renderTable({}, new Set(), onSelectionChange);
    fireEvent.click(screen.getByRole("checkbox", { name: SELECT_ALL }));

    expect(onSelectionChange.mock.calls[0][0]).toEqual(
      new Set(["1", "2", "3"]),
    );
  });

  it("clears the selection from the header checkbox when every row is selected", () => {
    const onSelectionChange = vi.fn();

    renderTable({}, new Set(["1", "2", "3"]), onSelectionChange);

    const selectAll = screen.getByRole("checkbox", { name: SELECT_ALL });

    expect(selectAll).toBeChecked();

    fireEvent.click(selectAll);

    expect(onSelectionChange.mock.calls[0][0]).toEqual(new Set());
  });

  it("shows the header checkbox as indeterminate while only some rows are selected", () => {
    renderTable({}, new Set(["2"]));

    const selectAll = screen.getByRole("checkbox", {
      name: SELECT_ALL,
    }) as HTMLInputElement;

    expect(selectAll.indeterminate).toBe(true);
    expect(selectAll).not.toBeChecked();
  });

  it("shows the header checkbox as plain empty when nothing is selected", () => {
    renderTable();

    const selectAll = screen.getByRole("checkbox", {
      name: SELECT_ALL,
    }) as HTMLInputElement;

    expect(selectAll.indeterminate).toBe(false);
    expect(selectAll).not.toBeChecked();
  });

  it("does not select a row when something else in it is clicked", () => {
    const onSelectionChange = vi.fn();

    renderTable({}, new Set(), onSelectionChange);
    fireEvent.click(screen.getByRole("rowheader", { name: "Grace" }));

    expect(onSelectionChange).not.toHaveBeenCalled();
  });

  it("leaves a button inside a row working without selecting the row", () => {
    const onSelectionChange = vi.fn();
    const onPress = vi.fn();
    const columns: DataTableColumn<Person>[] = [
      {
        key: "act",
        header: "Act",
        cell: (p) => (
          <button type="button" onClick={() => onPress(p.id)}>
            Do {p.name}
          </button>
        ),
      },
      ...COLUMNS,
    ];

    renderTable({ columns }, new Set(), onSelectionChange);
    fireEvent.click(screen.getByRole("button", { name: "Do Ada" }));

    expect(onPress).toHaveBeenCalledWith("1");
    expect(onSelectionChange).not.toHaveBeenCalled();
  });

  it("makes a row note span the checkbox column too", () => {
    renderTable({
      rowNote: (person) => (person.id === "2" ? <p>Careful</p> : null),
    });

    expect(bodyRows()[2].querySelector("td")).toHaveAttribute("colspan", "3");
  });

  it("gives the checkbox column a narrow fixed width", () => {
    renderTable();

    expect(screen.getAllByRole("columnheader")[0]).toHaveClass("w-11");
    expect(
      screen.getByRole("checkbox", { name: "Seleccionar Ada" }).closest("td"),
    ).toHaveClass("w-11");
  });
});

describe("DataTable busy rows", () => {
  const isRowBusy = (person: Person) => person.id === "2";

  it("marks the busy row, and only it, as busy and dims it", () => {
    renderTable({ isRowBusy });

    const rows = bodyRows();

    expect(rows[0]).not.toHaveAttribute("data-busy");
    expect(rows[1]).toHaveAttribute("data-busy", "true");
    expect(rows[1]).toHaveAttribute("aria-disabled", "true");
    expect(rows[1]).toHaveClass("opacity-50");
    expect(rows[2]).not.toHaveAttribute("data-busy");
    expect(rows[0]).not.toHaveClass("opacity-50");
  });

  it("marks the whole table as busy and announces why while a row is", () => {
    const { container } = renderTable({ isRowBusy, busyLabel: "Eliminando…" });

    expect(container.firstElementChild).toHaveAttribute("aria-busy", "true");
    expect(container.querySelector("[aria-live='polite']")).toHaveTextContent(
      "Eliminando…",
    );
  });

  it("is not busy, and says nothing, while no row is", () => {
    const { container } = renderTable({
      isRowBusy: () => false,
      busyLabel: "Eliminando…",
    });

    expect(container.firstElementChild).not.toHaveAttribute("aria-busy");
    expect(
      container.querySelector("[aria-live='polite']"),
    ).toBeEmptyDOMElement();
  });

  it("has no announcement without a busy label", () => {
    const { container } = renderTable({ isRowBusy });

    expect(container.querySelector("[aria-live]")).toBeNull();
  });

  it("locks the selection checkbox of a busy row", () => {
    const onSelectionChange = vi.fn();

    renderTable({ isRowBusy }, new Set(), onSelectionChange);

    const busy = screen.getByRole("checkbox", { name: "Seleccionar Grace" });

    expect(busy).toBeDisabled();
    expect(
      screen.getByRole("checkbox", { name: "Seleccionar Ada" }),
    ).toBeEnabled();

    fireEvent.click(busy);

    expect(onSelectionChange).not.toHaveBeenCalled();
  });

  it("does not select a busy row with the header checkbox", () => {
    const onSelectionChange = vi.fn();

    renderTable({ isRowBusy }, new Set(), onSelectionChange);
    fireEvent.click(screen.getByRole("checkbox", { name: SELECT_ALL }));

    expect(onSelectionChange.mock.calls[0][0]).toEqual(new Set(["1", "3"]));
  });

  it("does not mark rows as busy without isRowBusy", () => {
    renderTable();

    bodyRows().forEach((row) => expect(row).not.toHaveAttribute("data-busy"));
  });

  it("works without a selection too", () => {
    renderTable({ selection: undefined, isRowBusy });

    expect(bodyRows()[1]).toHaveAttribute("data-busy", "true");
    expect(bodyRows()[1]).toHaveAttribute("aria-disabled", "true");
  });
});

describe("DataTable loading with selection", () => {
  const columnClasses = () =>
    screen
      .getAllByRole("columnheader", { hidden: true })
      .map((header) => header.className);
  const firstRowCellClasses = () =>
    Array.from(
      screen
        .getAllByRole("rowgroup", { hidden: true })[1]
        .querySelectorAll("tr:first-child > td"),
    ).map((cell) => cell.className);

  it("keeps the checkbox column while loading, as a skeleton, with the same classes as when loaded", () => {
    const loaded = renderTable({ tableClassName: "table-fixed" });
    const loadedHeaders = columnClasses();
    const loadedCells = firstRowCellClasses();

    expect(loadedHeaders).toHaveLength(3);

    loaded.unmount();
    const { container } = renderTable({
      isLoading: true,
      tableClassName: "table-fixed",
    });

    expect(columnClasses()).toEqual(loadedHeaders);
    expect(firstRowCellClasses()).toEqual(loadedCells);
    // 3 columns of skeleton per row (checkbox + two), plus nothing interactive.
    expect(
      container.querySelectorAll("tbody tr:first-child .skeleton"),
    ).toHaveLength(3);
    expect(
      screen.queryByRole("checkbox", { hidden: true }),
    ).not.toBeInTheDocument();
  });

  it("has no checkbox column while loading without a selection", () => {
    renderTable({ isLoading: true, selection: undefined });

    expect(screen.getAllByRole("columnheader", { hidden: true })).toHaveLength(
      2,
    );
  });
});
