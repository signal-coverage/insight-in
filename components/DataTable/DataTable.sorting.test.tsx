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

const renderTable = (props: Partial<DataTableProps<Person>> = {}) =>
  render(
    <DataTable
      columns={COLUMNS}
      rows={PEOPLE}
      rowKey={(person) => person.id}
      isLoading={false}
      loadingLabel="Loading"
      emptyState={<p>Nobody here</p>}
      sort={{ key: "name", direction: "asc" }}
      onSortChange={vi.fn()}
      {...props}
    />,
  );

const header = (name: string) => screen.getByRole("columnheader", { name });

describe("DataTable sortable headers", () => {
  it("renders a button only in sortable headers", () => {
    renderTable();

    expect(screen.getByRole("button", { name: "Name" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Role" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Id" }),
    ).not.toBeInTheDocument();
  });

  it("does not render buttons when there is no onSortChange handler", () => {
    renderTable({ onSortChange: undefined });

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
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

  it("starts an inactive column in its default direction", () => {
    const onSortChange = vi.fn<(sort: DataTableSort) => void>();

    renderTable({ onSortChange });
    fireEvent.click(screen.getByRole("button", { name: "Role" }));

    expect(onSortChange).toHaveBeenCalledWith({
      key: "role",
      direction: "desc",
    });
  });

  it("starts an inactive column ascending when it declares no default", () => {
    const onSortChange = vi.fn<(sort: DataTableSort) => void>();

    renderTable({ onSortChange, sort: { key: "role", direction: "desc" } });
    fireEvent.click(screen.getByRole("button", { name: "Name" }));

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
    fireEvent.click(screen.getByRole("button", { name: "Name" }));
    expect(onSortChange).toHaveBeenLastCalledWith({
      key: "name",
      direction: "desc",
    });

    unmount();
    renderTable({ onSortChange, sort: { key: "name", direction: "desc" } });
    fireEvent.click(screen.getByRole("button", { name: "Name" }));
    expect(onSortChange).toHaveBeenLastCalledWith({
      key: "name",
      direction: "asc",
    });
  });

  it("keeps the header buttons out of row click handling", () => {
    const onRowClick = vi.fn();

    renderTable({ onRowClick });
    fireEvent.click(screen.getByRole("button", { name: "Name" }));

    expect(onRowClick).not.toHaveBeenCalled();
  });
});

describe("DataTable footer", () => {
  it("renders the footer inside the box when there are rows", () => {
    const { container } = renderTable({ footer: <p>Page 1 of 3</p> });

    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
    expect(container.firstElementChild).toContainElement(
      screen.getByText("Page 1 of 3"),
    );
  });

  it("does not render the footer for the empty state", () => {
    renderTable({ rows: [], footer: <p>Page 1 of 3</p> });

    expect(screen.queryByText("Page 1 of 3")).not.toBeInTheDocument();
  });
});
