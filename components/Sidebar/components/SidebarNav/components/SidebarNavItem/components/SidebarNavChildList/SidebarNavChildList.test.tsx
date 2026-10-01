// @vitest-environment jsdom
import { Squares2X2Icon } from "@heroicons/react/24/outline";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ pathname: "/dashboard/overview" }));

vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));

import { SidebarNavChildList } from "./SidebarNavChildList";

const ITEMS = [
  {
    label: "General",
    href: "/dashboard/overview",
    icon: Squares2X2Icon,
    exact: true,
  },
  {
    label: "Proyecto",
    href: "/dashboard/overview/project",
    icon: Squares2X2Icon,
  },
];

const renderList = () =>
  render(<SidebarNavChildList items={ITEMS} variant="tree" />);

beforeEach(() => {
  navigation.pathname = "/dashboard/overview";
});

describe("SidebarNavChildList", () => {
  it("links every item to its address", () => {
    renderList();

    expect(screen.getByRole("link", { name: "General" })).toHaveAttribute(
      "href",
      "/dashboard/overview",
    );
    expect(screen.getByRole("link", { name: "Proyecto" })).toHaveAttribute(
      "href",
      "/dashboard/overview/project",
    );
  });

  it("marks the item of the page being shown as the current one", () => {
    renderList();

    expect(screen.getByRole("link", { name: "General" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Proyecto" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("does not keep General current on the pages under it, which have their own item", () => {
    navigation.pathname = "/dashboard/overview/project";
    renderList();

    expect(screen.getByRole("link", { name: "Proyecto" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "General" })).not.toHaveAttribute(
      "aria-current",
    );
  });
});
