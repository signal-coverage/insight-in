// @vitest-environment jsdom
import { Squares2X2Icon } from "@heroicons/react/24/outline";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ pathname: "/dashboard/billing" }));

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
  navigation.pathname = "/dashboard/billing";
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

const renderExpanded = (forceExpanded?: boolean) =>
  render(
    <ul>
      <SidebarNavItemGroup
        item={ITEM}
        isCollapsed={false}
        forceExpanded={forceExpanded}
      />
    </ul>,
  );

describe("SidebarNavItemGroup (expanded sidebar, HeroUI disclosure)", () => {
  it("is a HeroUI disclosure whose trigger is a button", () => {
    const { container } = renderExpanded();

    expect(container.querySelector("[data-slot=disclosure]")).not.toBeNull();
    expect(trigger()).toHaveAttribute("data-slot", "disclosure-trigger");
    expect(trigger().tagName).toBe("BUTTON");
  });

  it("starts closed when none of its pages is the current one", () => {
    renderExpanded();

    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("link", { name: "Project" })).toBeNull();
  });

  it("opens and closes its pages when the trigger is pressed", () => {
    renderExpanded();

    fireEvent.click(trigger());

    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: "Project" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Revenue" })).toBeInTheDocument();

    fireEvent.click(trigger());

    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("link", { name: "Project" })).toBeNull();
  });

  it("starts open when one of its pages is the current one", () => {
    navigation.pathname = "/dashboard/overview/revenue";
    renderExpanded();

    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: "Revenue" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("stays open while a search forces every group open", () => {
    renderExpanded(true);

    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: "Project" })).toBeInTheDocument();
  });
});
