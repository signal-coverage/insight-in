// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const nextLink = vi.hoisted(() => ({ renders: 0 }));

// A stand-in for next/link that records that the HeroUI link delegates routing to it.
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
  }) => {
    nextLink.renders += 1;

    return (
      <a href={href} data-next-link="true" {...props}>
        {children}
      </a>
    );
  },
}));

import { SidebarNavLink } from "./SidebarNavLink";

describe("SidebarNavLink", () => {
  it("is a HeroUI link that hands navigation to next/link", () => {
    render(<SidebarNavLink href="/dashboard/expenses">Gastos</SidebarNavLink>);

    const link = screen.getByRole("link", { name: "Gastos" });

    expect(link).toHaveAttribute("href", "/dashboard/expenses");
    expect(link).toHaveAttribute("data-slot", "link");
    expect(link).toHaveAttribute("data-next-link", "true");
    expect(link).toHaveClass("link");
  });

  it("marks the page being shown as current", () => {
    render(
      <SidebarNavLink href="/dashboard/expenses" isActive>
        Gastos
      </SidebarNavLink>,
    );

    expect(screen.getByRole("link", { name: "Gastos" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("is not current unless it is active", () => {
    render(<SidebarNavLink href="/dashboard/expenses">Gastos</SidebarNavLink>);

    expect(screen.getByRole("link", { name: "Gastos" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("merges the caller's classes onto the link", () => {
    render(
      <SidebarNavLink href="/x" className="h-9 bg-accent">
        X
      </SidebarNavLink>,
    );

    expect(screen.getByRole("link", { name: "X" })).toHaveClass(
      "h-9",
      "bg-accent",
    );
  });

  it("still lets next/link handle the click (no default prevented by the HeroUI link)", () => {
    render(<SidebarNavLink href="/x">X</SidebarNavLink>);

    const notPrevented = fireEvent.click(
      screen.getByRole("link", { name: "X" }),
    );

    expect(notPrevented).toBe(true);
  });
});
