// @vitest-environment jsdom
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ pathname: "/dashboard/incomes" }));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ push: vi.fn() }),
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
    <a
      href={href}
      {...props}
      onClick={(event) => {
        // jsdom cannot navigate; keep the click from logging a "not implemented" error.
        event.preventDefault();
      }}
    >
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

import { Sidebar, SidebarProvider } from "@/components/Sidebar";

import { Navbar } from "./Navbar";

const Shell = () => (
  <SidebarProvider>
    <Sidebar />
    <Navbar />
  </SidebarProvider>
);

const renderShell = () => render(<Shell />);

beforeEach(() => {
  navigation.pathname = "/dashboard/incomes";
});

// While the overlay is open react-aria hides everything outside it from the accessibility tree.
const menuButton = () =>
  screen.getByRole("button", {
    name: "Abrir menú de navegación",
    hidden: true,
  });
const panel = () =>
  screen.queryByRole("dialog", { name: "Navegación principal" });

describe("Navbar menu button", () => {
  it("is a button that is hidden from md up and starts collapsed", () => {
    renderShell();

    expect(menuButton()).toHaveClass("md:hidden");
    expect(menuButton()).toHaveAttribute("aria-expanded", "false");
    expect(menuButton()).toHaveAttribute("aria-controls");
    expect(panel()).toBeNull();
  });

  it("opens the overlay with the full labelled navigation", () => {
    renderShell();

    fireEvent.click(menuButton());

    const dialog = panel();
    expect(dialog).not.toBeNull();
    expect(menuButton()).toHaveAttribute("aria-expanded", "true");
    expect(menuButton().getAttribute("aria-controls")).toBe(dialog!.id);
    expect(
      within(dialog!).getByRole("navigation", { name: "Navegación principal" }),
    ).toBeInTheDocument();
    expect(
      within(dialog!).getByRole("link", { name: "Ingresos" }),
    ).toBeInTheDocument();
    expect(within(dialog!).getByRole("searchbox")).toBeInTheDocument();
    expect(within(dialog!).getByText("Insight In")).toBeInTheDocument();
    expect(
      within(dialog!).getByRole("button", { name: "Iniciar sesión" }),
    ).toBeInTheDocument();
  });

  it("never renders the collapsed variant inside the overlay, even when the desktop one is collapsed", () => {
    renderShell();
    fireEvent.click(
      screen.getByRole("button", { name: "Contraer barra lateral" }),
    );
    // Positive twin: the desktop sidebar really is collapsed now.
    expect(
      screen.getByRole("button", { name: "Expandir barra lateral" }),
    ).toBeInTheDocument();

    fireEvent.click(menuButton());

    const dialog = panel()!;
    expect(within(dialog).getByText("Insight In")).toBeInTheDocument();
    expect(within(dialog).getByRole("searchbox")).toBeInTheDocument();
    expect(
      within(dialog).queryByRole("button", { name: "Expandir barra lateral" }),
    ).toBeNull();
  });

  it("closes when a navigation link is chosen", () => {
    renderShell();
    fireEvent.click(menuButton());

    fireEvent.click(within(panel()!).getByRole("link", { name: "Ingresos" }));

    expect(panel()).toBeNull();
  });

  it("stays open when something inside the panel that is not a link is clicked", () => {
    renderShell();
    fireEvent.click(menuButton());

    fireEvent.click(within(panel()!).getByText("Insight In"));
    fireEvent.click(within(panel()!).getByRole("searchbox"));

    expect(panel()).not.toBeNull();
  });

  it("closes when the route changes while it is open (the layout stays mounted)", async () => {
    const view = renderShell();
    fireEvent.click(menuButton());
    expect(menuButton()).toHaveAttribute("aria-expanded", "true");

    navigation.pathname = "/dashboard/banks";
    view.rerender(<Shell />);

    await waitFor(() => expect(panel()).toBeNull());
    expect(menuButton()).toHaveAttribute("aria-expanded", "false");
  });

  it("stays open when it re-renders on the same route", async () => {
    const view = renderShell();
    fireEvent.click(menuButton());

    view.rerender(<Shell />);

    expect(panel()).not.toBeNull();
    expect(menuButton()).toHaveAttribute("aria-expanded", "true");
  });

  it("closes with Escape", () => {
    renderShell();
    fireEvent.click(menuButton());

    fireEvent.keyDown(panel()!, { key: "Escape" });

    expect(panel()).toBeNull();
  });

  it("closes when the backdrop is pressed", async () => {
    renderShell();
    fireEvent.click(menuButton());
    const backdrop = document.querySelector(".drawer__backdrop")!;
    expect(backdrop).not.toBeNull();

    // The overlay only listens for outside presses once it has taken focus.
    await waitFor(() =>
      expect(panel()!.contains(document.activeElement)).toBe(true),
    );

    // A press on the dimmed area outside the panel.
    fireEvent.pointerDown(backdrop, { pointerType: "mouse", button: 0 });
    fireEvent.click(backdrop, { button: 0 });

    await waitFor(() => expect(panel()).toBeNull());
  });

  it("moves focus into the panel and gives it back to the menu button on close", async () => {
    renderShell();
    menuButton().focus();
    fireEvent.click(menuButton());

    await waitFor(() =>
      expect(panel()!.contains(document.activeElement)).toBe(true),
    );
    expect(document.activeElement).not.toBe(menuButton());

    fireEvent.keyDown(panel()!, { key: "Escape" });

    expect(panel()).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(menuButton()));
  });
});

describe("Desktop sidebar", () => {
  it("is only shown from md up and keeps its collapse toggle", () => {
    renderShell();

    const aside = screen.getByRole("complementary");
    expect(aside).toHaveClass("hidden", "md:block");
    expect(aside).toHaveClass("w-64");

    fireEvent.click(
      screen.getByRole("button", { name: "Contraer barra lateral" }),
    );

    expect(aside).toHaveClass("w-16");
    expect(aside).not.toHaveClass("w-64");
  });
});
