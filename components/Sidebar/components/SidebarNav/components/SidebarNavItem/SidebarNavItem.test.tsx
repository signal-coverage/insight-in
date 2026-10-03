// @vitest-environment jsdom
import { Squares2X2Icon } from "@heroicons/react/24/outline";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

import type { NavItem } from "../../../../types";
import { SidebarNavItem } from "./SidebarNavItem";

const ITEM: NavItem = {
  label: "Gastos",
  href: "/dashboard/expenses",
  icon: Squares2X2Icon,
};

const renderItem = (isCollapsed: boolean, item: NavItem = ITEM) =>
  render(
    <ul>
      <SidebarNavItem item={item} isCollapsed={isCollapsed} />
    </ul>,
  );

beforeEach(() => {
  navigation.pathname = "/dashboard/expenses";
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("SidebarNavItem (leaf link)", () => {
  it("is a HeroUI link to its address", () => {
    renderItem(false);

    const link = screen.getByRole("link", { name: "Gastos" });

    expect(link).toHaveAttribute("href", "/dashboard/expenses");
    expect(link).toHaveAttribute("data-slot", "link");
  });

  it("marks the page being shown as current and gives it the accent", () => {
    renderItem(false);

    const link = screen.getByRole("link", { name: "Gastos" });

    expect(link).toHaveAttribute("aria-current", "page");
    expect(link).toHaveClass("bg-accent");
  });

  it("is neither current nor accented on another page", () => {
    navigation.pathname = "/dashboard/income";
    renderItem(false);

    const link = screen.getByRole("link", { name: "Gastos" });

    expect(link).not.toHaveAttribute("aria-current");
    expect(link).not.toHaveClass("bg-accent");
  });

  it("keeps the label readable by screen readers when collapsed", () => {
    renderItem(true);

    expect(screen.getByRole("link", { name: "Gastos" })).toBeInTheDocument();
    expect(screen.getByText("Gastos")).toHaveClass("sr-only");
  });

  it("shows its label in a tooltip when collapsed and focused with the keyboard", () => {
    renderItem(true);

    fireEvent.keyDown(document.body, { key: "Tab" });
    act(() => {
      screen.getByRole("link", { name: "Gastos" }).focus();
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByRole("tooltip")).toHaveTextContent("Gastos");
  });

  it("shows no tooltip when expanded, where the label is already visible", () => {
    renderItem(false);

    fireEvent.keyDown(document.body, { key: "Tab" });
    act(() => {
      screen.getByRole("link", { name: "Gastos" }).focus();
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});
