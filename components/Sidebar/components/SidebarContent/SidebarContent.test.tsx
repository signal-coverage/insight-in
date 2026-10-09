// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/incomes",
}));
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
vi.mock("@clerk/nextjs", () => ({
  Show: ({ when, children }: { when: string; children: React.ReactNode }) =>
    when === "signed-out" ? <>{children}</> : null,
  SignInButton: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

import { SidebarContent } from "./SidebarContent";

describe("SidebarContent", () => {
  it("shows the brand, the search, the navigation and the footer when expanded", () => {
    render(<SidebarContent isCollapsed={false} />);

    expect(screen.getByText("Insight In")).toBeInTheDocument();
    expect(screen.getByRole("searchbox")).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Navegación principal" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ingresos" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Iniciar sesión" }),
    ).toBeInTheDocument();
  });

  it("drops the search and the brand wordmark when collapsed", () => {
    render(<SidebarContent isCollapsed />);

    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(screen.queryByText("Insight In")).toBeNull();
    // Positive twin: the navigation is still there.
    expect(
      screen.getByRole("navigation", { name: "Navegación principal" }),
    ).toBeInTheDocument();
  });

  it("filters the navigation with the search", () => {
    render(<SidebarContent isCollapsed={false} />);
    expect(screen.getByRole("link", { name: "Bancos" })).toBeInTheDocument();

    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "Ingresos" },
    });

    expect(screen.getByRole("link", { name: "Ingresos" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Bancos" })).toBeNull();
  });
});
