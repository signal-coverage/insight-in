// @vitest-environment jsdom
import { Squares2X2Icon } from "@heroicons/react/24/outline";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard/billing" }));
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

import type { NavItem } from "../../../../../../types";
import { SidebarNavItemGroup } from "./SidebarNavItemGroup";

const ITEM: NavItem = {
  label: "Overview",
  href: "/dashboard/overview",
  icon: Squares2X2Icon,
  children: [
    {
      label: "Project",
      href: "/dashboard/overview/project",
      icon: Squares2X2Icon,
    },
    {
      label: "Revenue",
      href: "/dashboard/overview/revenue",
      icon: Squares2X2Icon,
    },
  ],
};

const renderCollapsed = () =>
  render(
    <ul>
      <SidebarNavItemGroup item={ITEM} isCollapsed />
    </ul>,
  );

const trigger = () => screen.getByRole("button", { name: /Overview/ });
const underlay = () => document.body.querySelector('[data-testid="underlay"]');
const flyout = () => screen.queryByRole("dialog");

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("SidebarNavItemGroup (collapsed hover flyout)", () => {
  it("opens the flyout when the pointer enters the trigger", () => {
    renderCollapsed();

    fireEvent.mouseEnter(trigger());

    expect(flyout()).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Project" })).toBeInTheDocument();
  });

  it("does not render a full-screen underlay while open (it would steal the pointer from the trigger)", () => {
    renderCollapsed();

    fireEvent.mouseEnter(trigger());

    expect(flyout()).toBeInTheDocument();
    expect(underlay()).toBeNull();
  });

  it("closes after the grace delay once the pointer leaves the trigger", () => {
    renderCollapsed();

    fireEvent.mouseEnter(trigger());
    fireEvent.mouseLeave(trigger());

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(flyout()).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(flyout()).toBeNull();
  });

  it("stays open when the pointer moves from the trigger into the flyout within the grace delay", () => {
    renderCollapsed();

    fireEvent.mouseEnter(trigger());
    fireEvent.mouseLeave(trigger());
    act(() => {
      vi.advanceTimersByTime(50);
    });
    fireEvent.mouseEnter(screen.getByRole("dialog"));
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(flyout()).toBeInTheDocument();
  });

  it("closes with Escape", () => {
    renderCollapsed();

    fireEvent.mouseEnter(trigger());
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    act(() => {
      vi.advanceTimersByTime(50);
    });

    expect(flyout()).toBeNull();
  });
});
