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

  it("is a HeroUI pagination: a labelled nav with its summary and its previous, page and next items", () => {
    renderPagination({ page: 2, totalPages: 4, total: 83 });

    const nav = screen.getByRole("navigation", { name: "Paginación" });

    expect(nav).toHaveAttribute("data-slot", "pagination");
    expect(
      nav.querySelector('[data-slot="pagination-summary"]'),
    ).toHaveTextContent("Mostrando 26-50 de 83");
    expect(nav.querySelectorAll('[data-slot="pagination-item"]')).toHaveLength(
      3,
    );
    expect(
      nav.querySelector('[data-slot="pagination-previous"]'),
    ).toHaveTextContent("Anterior");
    expect(
      nav.querySelector('[data-slot="pagination-next"]'),
    ).toHaveTextContent("Siguiente");
  });

  it("keeps both buttons enabled on a middle page", () => {
    renderPagination({ page: 2, totalPages: 4, total: 83 });

    expect(screen.getByRole("button", { name: "Anterior" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Siguiente" })).toBeEnabled();
  });

  it("disables only Previous on the first page and only Next on the last", () => {
    const { unmount } = render(
      <EntriesPagination
        page={1}
        totalPages={4}
        total={83}
        pageSize={25}
        onPageChange={() => {}}
      />,
    );

    expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Siguiente" })).toBeEnabled();

    unmount();
    render(
      <EntriesPagination
        page={4}
        totalPages={4}
        total={83}
        pageSize={25}
        onPageChange={() => {}}
      />,
    );

    expect(screen.getByRole("button", { name: "Anterior" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Siguiente" })).toBeDisabled();
  });

  it("does not change the page from a disabled button", () => {
    const { onPageChange } = renderPagination({
      page: 1,
      totalPages: 1,
      total: 10,
    });

    fireEvent.click(screen.getByRole("button", { name: "Anterior" }));
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));

    expect(onPageChange).not.toHaveBeenCalled();
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
