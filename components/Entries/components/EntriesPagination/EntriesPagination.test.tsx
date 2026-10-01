// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EntriesPagination } from "./EntriesPagination";

const renderPagination = (props: {
  page: number;
  totalPages: number;
  total: number;
}) => {
  const onPageChange = vi.fn();

  render(
    <EntriesPagination pageSize={25} onPageChange={onPageChange} {...props} />,
  );

  return { onPageChange };
};

describe("EntriesPagination", () => {
  it("summarizes the visible range of a middle page", () => {
    renderPagination({ page: 2, totalPages: 4, total: 83 });

    expect(screen.getByText("Mostrando 26-50 de 83")).toBeInTheDocument();
    expect(screen.getByText("Página 2 de 4")).toBeInTheDocument();
  });

  it("ends the range at the total on the last page", () => {
    renderPagination({ page: 4, totalPages: 4, total: 83 });

    expect(screen.getByText("Mostrando 76-83 de 83")).toBeInTheDocument();
  });

  it("handles a single item", () => {
    renderPagination({ page: 1, totalPages: 1, total: 1 });

    expect(screen.getByText("Mostrando 1-1 de 1")).toBeInTheDocument();
  });

  it("disables Previous on the first page and Next on the last", () => {
    renderPagination({ page: 1, totalPages: 1, total: 10 });

    expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Siguiente" })).toBeDisabled();
  });

  it("goes to the next and previous pages", () => {
    const { onPageChange } = renderPagination({
      page: 2,
      totalPages: 4,
      total: 83,
    });

    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(onPageChange).toHaveBeenLastCalledWith(3);

    fireEvent.click(screen.getByRole("button", { name: "Anterior" }));
    expect(onPageChange).toHaveBeenLastCalledWith(1);
  });
});
