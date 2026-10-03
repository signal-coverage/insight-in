// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DataTable } from "./DataTable";
import type { DataTableColumn, DataTableProps, DataTableSort } from "./types";

interface Person {
  id: string;
  name: string;
  role: string;
}

const PEOPLE: Person[] = [
  { id: "1", name: "Ada", role: "Engineer" },
  { id: "2", name: "Grace", role: "Admiral" },
];

const COLUMNS: DataTableColumn<Person>[] = [
  {
    key: "name",
    header: "Name",
    sortable: true,
    cell: (person) => person.name,
  },
  {
    key: "role",
    header: "Role",
    sortable: true,
    defaultSortDirection: "desc",
    cell: (person) => person.role,
  },
  { key: "id", header: "Id", cell: (person) => person.id },
];

const tableProps = (
  props: Partial<DataTableProps<Person>> = {},
): DataTableProps<Person> => ({
  label: "People",
  columns: COLUMNS,
  rows: PEOPLE,
  rowKey: (person) => person.id,
  isLoading: false,
  loadingLabel: "Loading",
  emptyState: <p>Nobody here</p>,
  sort: { key: "name", direction: "asc" },
  onSortChange: vi.fn(),
  ...props,
});

const renderTable = (props: Partial<DataTableProps<Person>> = {}) =>
  render(<DataTable {...tableProps(props)} />);

const header = (name: string | RegExp) =>
  screen.getByRole("columnheader", { name });

describe("DataTable sortable headers", () => {
  it("makes only the sortable columns sortable HeroUI columns", () => {
    renderTable();

    expect(header("Name")).toHaveAttribute("data-allows-sorting", "true");
    expect(header("Role")).toHaveAttribute("data-allows-sorting", "true");
    expect(header("Id")).not.toHaveAttribute("data-allows-sorting");
  });

  it("does not make any header sortable when there is no onSortChange handler", () => {
    renderTable({ onSortChange: undefined });

    screen.getAllByRole("columnheader").forEach((column) => {
      expect(column).not.toHaveAttribute("data-allows-sorting");
      expect(column).not.toHaveAttribute("aria-sort");
    });
  });

  it("exposes the sort state with aria-sort", () => {
    renderTable({ sort: { key: "name", direction: "asc" } });

    expect(header("Name")).toHaveAttribute("aria-sort", "ascending");
    expect(header("Role")).toHaveAttribute("aria-sort", "none");
    expect(header("Id")).not.toHaveAttribute("aria-sort");
  });

  it("reports a descending sort", () => {
    renderTable({ sort: { key: "role", direction: "desc" } });

    expect(header("Role")).toHaveAttribute("aria-sort", "descending");
    expect(header("Name")).toHaveAttribute("aria-sort", "none");
  });

  it("shows no aria-sort state of its own while nothing is sorted", () => {
    renderTable({ sort: undefined });

    expect(header("Name")).toHaveAttribute("aria-sort", "none");
    expect(header("Role")).toHaveAttribute("aria-sort", "none");
  });

  it("marks the sorted column with a direction indicator and the others with the up-down one", () => {
    renderTable({ sort: { key: "role", direction: "desc" } });

    const sorted = header("Role").querySelector(
      '[data-slot="table-sortable-column-indicator"]',
    );

    expect(sorted).toHaveAttribute("data-direction", "descending");
    expect(
      header("Name").querySelector(
        '[data-slot="table-sortable-column-indicator"]',
      ),
    ).toBeNull();
    expect(header("Name").querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("starts an inactive column in its default direction", () => {
    const onSortChange = vi.fn<(sort: DataTableSort) => void>();

    renderTable({ onSortChange });
    fireEvent.click(header("Role"));

    expect(onSortChange).toHaveBeenCalledWith({
      key: "role",
      direction: "desc",
    });
  });

  it("starts an inactive column ascending when it declares no default", () => {
    const onSortChange = vi.fn<(sort: DataTableSort) => void>();

    renderTable({ onSortChange, sort: { key: "role", direction: "desc" } });
    fireEvent.click(header("Name"));

    expect(onSortChange).toHaveBeenCalledWith({
      key: "name",
      direction: "asc",
    });
  });

  it("toggles the direction when the active column is clicked", () => {
    const onSortChange = vi.fn<(sort: DataTableSort) => void>();

    const { unmount } = renderTable({
      onSortChange,
      sort: { key: "name", direction: "asc" },
    });
    fireEvent.click(header("Name"));
    expect(onSortChange).toHaveBeenLastCalledWith({
      key: "name",
      direction: "desc",
    });

    unmount();
    renderTable({ onSortChange, sort: { key: "name", direction: "desc" } });
    fireEvent.click(header("Name"));
    expect(onSortChange).toHaveBeenLastCalledWith({
      key: "name",
      direction: "asc",
    });
  });

  it("cycles through the caller's sort: the table only reports, the caller decides", () => {
    const seen: DataTableSort[] = [];
    let sort: DataTableSort | undefined = { key: "name", direction: "asc" };
    const onSortChange = (next: DataTableSort) => {
      seen.push(next);
      sort = next;
    };
    const { rerender } = renderTable({ sort, onSortChange });

    fireEvent.click(header("Name"));
    rerender(<DataTable {...tableProps({ sort, onSortChange })} />);
    expect(header("Name")).toHaveAttribute("aria-sort", "descending");

    fireEvent.click(header("Name"));
    rerender(<DataTable {...tableProps({ sort, onSortChange })} />);
    expect(header("Name")).toHaveAttribute("aria-sort", "ascending");

    fireEvent.click(header("Role"));
    rerender(<DataTable {...tableProps({ sort, onSortChange })} />);
    expect(header("Role")).toHaveAttribute("aria-sort", "descending");
    expect(header("Name")).toHaveAttribute("aria-sort", "none");

    expect(seen).toEqual([
      { key: "name", direction: "desc" },
      { key: "name", direction: "asc" },
      { key: "role", direction: "desc" },
    ]);
  });

  it("does not report anything for a header that is not sortable", () => {
    const onSortChange = vi.fn();

    renderTable({ onSortChange });
    fireEvent.click(header("Id"));

    expect(onSortChange).not.toHaveBeenCalled();
  });

  it("keeps the header presses out of row click handling", () => {
    const onRowClick = vi.fn();

    renderTable({ onRowClick });
    fireEvent.click(header("Name"));

    expect(onRowClick).not.toHaveBeenCalled();
  });

  it("does not sort the loading table's headers", () => {
    renderTable({ isLoading: true });

    screen.getAllByRole("columnheader", { hidden: true }).forEach((column) => {
      expect(column).not.toHaveAttribute("data-allows-sorting");
    });
  });
});

describe("DataTable footer", () => {
  it("renders the footer inside the box when there are rows", () => {
    const { container } = renderTable({ footer: <p>Page 1 of 3</p> });

    const footer = screen.getByText("Page 1 of 3");

    expect(footer).toBeInTheDocument();
    expect(container.firstElementChild).toContainElement(footer);
    expect(footer.closest('[data-slot="table-footer"]')).toHaveClass(
      "border-t",
      "border-border",
    );
  });

  it("does not render the footer for the empty state", () => {
    renderTable({ rows: [], footer: <p>Page 1 of 3</p> });

    expect(screen.queryByText("Page 1 of 3")).not.toBeInTheDocument();
  });

  it("renders no footer slot without a footer", () => {
    const { container } = renderTable();

    expect(container.querySelector('[data-slot="table-footer"]')).toBeNull();
  });
});
