// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const clerk = vi.hoisted(() => ({ profileProps: vi.fn() }));

// Clerk draws the profile from its own script; here it is a stand-in that records what it is given.
vi.mock("@clerk/nextjs", () => ({
  UserProfile: (props: Record<string, unknown>) => {
    clerk.profileProps(props);

    return <div data-testid="user-profile" />;
  },
}));

import { USER_PROFILE_APPEARANCE } from "@/lib/clerk-appearance";

import { Account } from "./Account";

beforeEach(() => {
  clerk.profileProps.mockClear();
});

describe("Account page", () => {
  it("is titled Cuenta and says what it is for", () => {
    render(<Account />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Cuenta" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Tus datos personales, la seguridad y las sesiones abiertas.",
      ),
    ).toBeInTheDocument();
  });

  it("shows Clerk's user profile under the header, inside the page's one main landmark", () => {
    render(<Account />);

    expect(screen.getAllByRole("main")).toHaveLength(1);
    expect(screen.getByRole("main")).toContainElement(
      screen.getByTestId("user-profile"),
    );
  });

  it("keeps the profile's own pages in the address hash, so the route stays /dashboard/account", () => {
    render(<Account />);

    expect(clerk.profileProps).toHaveBeenCalledWith(
      expect.objectContaining({ routing: "hash" }),
    );
  });

  it("gives the profile the page-width appearance, without its own shadow", () => {
    render(<Account />);

    expect(clerk.profileProps).toHaveBeenCalledWith(
      expect.objectContaining({ appearance: USER_PROFILE_APPEARANCE }),
    );
    expect(USER_PROFILE_APPEARANCE.elements.cardBox).toMatchObject({
      width: "100%",
      maxWidth: "100%",
      boxShadow: "none",
    });
    expect(USER_PROFILE_APPEARANCE.elements.rootBox).toEqual({ width: "100%" });
  });

  it("lets the profile shrink to a phone screen instead of widening the page", () => {
    render(<Account />);

    expect(screen.getByTestId("user-profile").parentElement).toHaveClass(
      "w-full",
      "min-w-0",
    );
  });
});
