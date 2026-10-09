// @vitest-environment jsdom
import { Squares2X2Icon } from "@heroicons/react/24/outline";
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ pathname: "/dashboard/expenses" }));

vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import type { NavSection } from "../../types";
import { SidebarNav } from "./SidebarNav";

const icon = Squares2X2Icon;

const SECTIONS: readonly NavSection[] = [
  {
    label: "Movimientos",
    items: [
      { label: "Ingresos", href: "/dashboard/incomes", icon },
      { label: "Gastos", href: "/dashboard/expenses", icon },
    ],
  },
  {
    label: "Cuentas",
    items: [{ label: "Bancos", href: "/dashboard/banks", icon }],
  },
  {
    label: null,
    items: [{ label: "Hoja de ruta", href: "/dashboard/roadmap", icon }],
  },
];

beforeEach(() => {
  navigation.pathname = "/dashboard/expenses";
});

describe("SidebarNav (sections)", () => {
  it("keeps its accessible name", () => {
    render(<SidebarNav sections={SECTIONS} isCollapsed={false} />);

    expect(
      screen.getByRole("navigation", { name: "Navegación principal" }),
    ).toBeInTheDocument();
  });

  it("shows every section title, in order, as plain text and not as a link", () => {
    render(<SidebarNav sections={SECTIONS} isCollapsed={false} />);

    const titles = screen
      .getAllByRole("list")
      .map((list) => list.getAttribute("aria-labelledby"))
      .filter((id): id is string => id !== null)
      .map((id) => document.getElementById(id));

    expect(titles.map((title) => title?.textContent)).toEqual([
      "Movimientos",
      "Cuentas",
    ]);
    expect(screen.queryByRole("link", { name: "Movimientos" })).toBeNull();
    expect(screen.getByRole("link", { name: "Gastos" })).toBeInTheDocument();
  });

  it("labels each titled list with its title and leaves the untitled one without a label", () => {
    render(<SidebarNav sections={SECTIONS} isCollapsed={false} />);

    const movements = screen.getByRole("list", { name: "Movimientos" });
    const accounts = screen.getByRole("list", { name: "Cuentas" });

    expect(
      within(movements)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(["Ingresos", "Gastos"]);
    expect(
      within(accounts)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(["Bancos"]);

    const untitled = screen
      .getAllByRole("list")
      .filter((list) => !list.hasAttribute("aria-labelledby"));

    expect(untitled).toHaveLength(1);
    expect(
      within(untitled[0]).getByRole("link", { name: "Hoja de ruta" }),
    ).toBeInTheDocument();
  });

  it("keeps the keyboard order equal to the visual order", () => {
    render(<SidebarNav sections={SECTIONS} isCollapsed={false} />);

    expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual(
      ["Ingresos", "Gastos", "Bancos", "Hoja de ruta"],
    );
  });

  it("marks only the current page as current", () => {
    render(<SidebarNav sections={SECTIONS} isCollapsed={false} />);

    expect(screen.getByRole("link", { name: "Gastos" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Bancos" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("hides the titles visually when collapsed but keeps the lists named and the links in place", () => {
    render(<SidebarNav sections={SECTIONS} isCollapsed />);

    const movements = screen.getByRole("list", { name: "Movimientos" });
    const title = document.getElementById(
      movements.getAttribute("aria-labelledby") ?? "",
    );

    expect(title).toHaveClass("sr-only");
    expect(screen.getByRole("list", { name: "Cuentas" })).toBeInTheDocument();
    expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual(
      ["Ingresos", "Gastos", "Bancos", "Hoja de ruta"],
    );
  });

  it("shows the titles visibly when expanded", () => {
    render(<SidebarNav sections={SECTIONS} isCollapsed={false} />);

    const movements = screen.getByRole("list", { name: "Movimientos" });
    const title = document.getElementById(
      movements.getAttribute("aria-labelledby") ?? "",
    );

    expect(title).not.toHaveClass("sr-only");
  });

  it("shows the empty state, and no list, when there are no sections", () => {
    render(<SidebarNav sections={[]} isCollapsed={false} />);

    expect(screen.getByText("Sin resultados")).toBeInTheDocument();
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("does not show the empty state when there are sections", () => {
    render(<SidebarNav sections={SECTIONS} isCollapsed={false} />);

    expect(screen.queryByText("Sin resultados")).toBeNull();
    expect(screen.getAllByRole("list")).toHaveLength(3);
  });
});
