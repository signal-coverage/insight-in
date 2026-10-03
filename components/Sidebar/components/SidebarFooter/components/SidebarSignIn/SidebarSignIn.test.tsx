// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { cloneElement, type ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const clerk = vi.hoisted(() => ({ opened: vi.fn() }));

// Mirrors Clerk's SignInButton: it clones its single child and injects `onClick`.
vi.mock("@clerk/nextjs", () => ({
  SignInButton: ({ children }: { children: ReactElement }) =>
    cloneElement(children as ReactElement<{ onClick?: () => void }>, {
      onClick: () => clerk.opened(),
    }),
}));

import { SidebarSignIn } from "./SidebarSignIn";

afterEach(() => {
  vi.restoreAllMocks();
  clerk.opened.mockClear();
});

describe("SidebarSignIn", () => {
  it("is a HeroUI button with a visible label when the sidebar is expanded", () => {
    render(<SidebarSignIn isCollapsed={false} />);

    const button = screen.getByRole("button", { name: "Iniciar sesión" });

    expect(button).toHaveClass("button");
    expect(button).toHaveTextContent("Iniciar sesión");
  });

  it("is an icon-only HeroUI button with an accessible name when collapsed", () => {
    render(<SidebarSignIn isCollapsed />);

    const button = screen.getByRole("button", { name: "Iniciar sesión" });

    expect(button).toHaveClass("button", "button--icon-only");
    expect(button).not.toHaveTextContent("Iniciar sesión");
  });

  it("hands the press to Clerk, once and without a deprecation warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(<SidebarSignIn isCollapsed={false} />);

    fireEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(clerk.opened).toHaveBeenCalledTimes(1);
    expect(warn).not.toHaveBeenCalled();
  });
});
