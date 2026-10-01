// @vitest-environment jsdom
import { PlusIcon } from "@heroicons/react/24/outline";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PageHeader } from "./PageHeader";

const ITEMS = [{ id: "add", label: "Agregar gasto", Icon: PlusIcon }];

const renderHeader = () => {
  const onAction = vi.fn();

  const { container } = render(
    <PageHeader
      title="Gastos"
      description="Registra y revisa el dinero que gastas."
      actionsLabel="Acciones"
      actions={ITEMS}
      onAction={onAction}
    />,
  );

  return { onAction, container };
};

describe("PageHeader", () => {
  it("shows the title as the page heading, with its description", () => {
    renderHeader();

    expect(
      screen.getByRole("heading", { level: 1, name: "Gastos" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Registra y revisa el dinero que gastas."),
    ).toBeInTheDocument();
  });

  it("renders a header element", () => {
    const { container } = renderHeader();

    expect(container.querySelector("header")).not.toBeNull();
  });

  it("has one Actions button, which opens the menu with the given items", async () => {
    renderHeader();

    expect(screen.getAllByRole("button")).toHaveLength(1);

    fireEvent.keyDown(screen.getByRole("button", { name: "Acciones" }), {
      key: "ArrowDown",
    });

    expect(
      await screen.findByRole("menuitem", { name: "Agregar gasto" }),
    ).toBeInTheDocument();
  });

  it("reports the chosen action's id", async () => {
    const { onAction } = renderHeader();

    fireEvent.keyDown(screen.getByRole("button", { name: "Acciones" }), {
      key: "ArrowDown",
    });

    const item = await screen.findByRole("menuitem", { name: "Agregar gasto" });

    fireEvent.keyDown(item, { key: "Enter" });
    fireEvent.keyUp(item, { key: "Enter" });

    expect(onAction).toHaveBeenCalledWith("add");
  });
});

describe("PageHeader without actions", () => {
  it("shows the title and the description but no Actions button", () => {
    render(<PageHeader title="Resumen" description="Septiembre de 2026" />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Resumen" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Septiembre de 2026")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("puts what it is given beside the title, on the side where the Actions button would be", () => {
    const { container } = render(
      <PageHeader
        title="Resumen"
        description="Ingresos y gastos del mes."
        aside={<nav aria-label="Mes">selector</nav>}
      />,
    );

    const header = container.querySelector("header")!;

    expect(header).toContainElement(
      screen.getByRole("navigation", { name: "Mes" }),
    );
    expect(header.lastElementChild).toBe(
      screen.getByRole("navigation", { name: "Mes" }),
    );
  });

  it("has no side content unless it is given some", () => {
    const { container } = render(
      <PageHeader title="Resumen" description="Ingresos y gastos del mes." />,
    );

    expect(container.querySelector("header")!.children).toHaveLength(1);
  });
});
