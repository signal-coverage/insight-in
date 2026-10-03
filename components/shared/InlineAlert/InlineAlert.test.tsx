// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { InlineAlert } from "./InlineAlert";

describe("InlineAlert", () => {
  it("announces errors as alerts with the message and an icon", () => {
    const { container } = render(
      <InlineAlert variant="error">Something failed.</InlineAlert>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Something failed.");
    expect(container.querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it.each(["success", "warning"] as const)(
    "announces %s politely",
    (variant) => {
      render(<InlineAlert variant={variant}>Done.</InlineAlert>);

      expect(screen.getByRole("status")).toHaveTextContent("Done.");
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    },
  );

  it.each([
    ["error", "alert--danger"],
    ["success", "alert--success"],
    ["warning", "alert--warning"],
  ] as const)("renders %s as a HeroUI alert (%s)", (variant, modifier) => {
    render(<InlineAlert variant={variant}>Message</InlineAlert>);

    const root = screen.getByRole(variant === "error" ? "alert" : "status");

    expect(root).toHaveAttribute("data-slot", "alert-root");
    expect(root).toHaveClass("alert", modifier);
    expect(root.querySelector("[data-slot='alert-indicator']")).not.toBeNull();
    expect(
      root.querySelector("[data-slot='alert-description']"),
    ).toHaveTextContent("Message");
  });

  it("merges a caller className onto the alert", () => {
    render(
      <InlineAlert variant="success" className="mt-4">
        Saved
      </InlineAlert>,
    );

    expect(screen.getByRole("status")).toHaveClass("mt-4");
  });

  it("uses a different icon per variant", () => {
    const paths = (["error", "success", "warning"] as const).map((variant) => {
      const { container, unmount } = render(
        <InlineAlert variant={variant}>x</InlineAlert>,
      );
      const d = container.querySelector("path")?.getAttribute("d");

      unmount();

      return d;
    });

    expect(new Set(paths).size).toBe(3);
  });
});
