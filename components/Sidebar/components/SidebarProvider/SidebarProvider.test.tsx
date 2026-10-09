// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SidebarProvider } from "./SidebarProvider";
import { useSidebar } from "./useSidebar";

type Listener = (event: { matches: boolean }) => void;

// jsdom has no media queries: a controllable stand-in for `window.matchMedia`.
function installMatchMedia(initialMatches: boolean) {
  const listeners = new Set<Listener>();
  const query = {
    matches: initialMatches,
    addEventListener: vi.fn((_type: string, listener: Listener) =>
      listeners.add(listener),
    ),
    removeEventListener: vi.fn((_type: string, listener: Listener) =>
      listeners.delete(listener),
    ),
  };
  const matchMedia = vi.fn(() => query);
  vi.stubGlobal("matchMedia", matchMedia);

  return {
    matchMedia,
    listeners,
    change: (matches: boolean) => {
      query.matches = matches;
      act(() => listeners.forEach((listener) => listener({ matches })));
    },
  };
}

function Probe() {
  const { isMobileOpen, openMobile, closeMobile, isCollapsed, toggle } =
    useSidebar();

  return (
    <div>
      <output data-testid="mobile">{String(isMobileOpen)}</output>
      <output data-testid="collapsed">{String(isCollapsed)}</output>
      <button onClick={openMobile}>open</button>
      <button onClick={closeMobile}>close</button>
      <button onClick={toggle}>toggle</button>
    </div>
  );
}

const renderProbe = () =>
  render(
    <SidebarProvider>
      <Probe />
    </SidebarProvider>,
  );

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SidebarProvider mobile overlay", () => {
  it("starts closed, opens and closes", () => {
    renderProbe();

    expect(screen.getByTestId("mobile")).toHaveTextContent("false");
    fireEvent.click(screen.getByText("open"));
    expect(screen.getByTestId("mobile")).toHaveTextContent("true");
    fireEvent.click(screen.getByText("close"));
    expect(screen.getByTestId("mobile")).toHaveTextContent("false");
  });

  it("keeps the desktop collapse state independent of the overlay", () => {
    renderProbe();

    fireEvent.click(screen.getByText("toggle"));
    expect(screen.getByTestId("collapsed")).toHaveTextContent("true");
    expect(screen.getByTestId("mobile")).toHaveTextContent("false");
    fireEvent.click(screen.getByText("open"));
    expect(screen.getByTestId("collapsed")).toHaveTextContent("true");
    expect(screen.getByTestId("mobile")).toHaveTextContent("true");
  });

  it("asks for the desktop breakpoint (768px, Tailwind md)", () => {
    const media = installMatchMedia(false);
    renderProbe();

    expect(media.matchMedia).toHaveBeenCalledWith("(min-width: 768px)");
    expect(media.listeners.size).toBe(1);
  });

  it("closes the overlay when the viewport grows to the desktop breakpoint", () => {
    const media = installMatchMedia(false);
    renderProbe();
    fireEvent.click(screen.getByText("open"));
    expect(screen.getByTestId("mobile")).toHaveTextContent("true");

    media.change(true);

    expect(screen.getByTestId("mobile")).toHaveTextContent("false");
  });

  it("stays open when the viewport changes but is still narrow", () => {
    const media = installMatchMedia(false);
    renderProbe();
    fireEvent.click(screen.getByText("open"));

    media.change(false);

    expect(screen.getByTestId("mobile")).toHaveTextContent("true");
  });

  it("stops listening when it unmounts", () => {
    const media = installMatchMedia(false);
    const view = renderProbe();
    expect(media.listeners.size).toBe(1);

    view.unmount();

    expect(media.listeners.size).toBe(0);
  });

  it("works without matchMedia", () => {
    renderProbe();

    fireEvent.click(screen.getByText("open"));
    expect(screen.getByTestId("mobile")).toHaveTextContent("true");
  });
});
