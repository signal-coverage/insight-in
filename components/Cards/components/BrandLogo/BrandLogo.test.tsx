// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BrandLogo } from "./BrandLogo";

describe("BrandLogo", () => {
  it("shows Remix Icon's Visa logo, without any text, so it never adds to a label", () => {
    const { container } = render(<BrandLogo brand="VISA" />);
    const icon = container.querySelector("[data-brand-logo='VISA'] i");

    expect(icon).toHaveClass("ri-visa-fill");
    expect(icon).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector("svg")).toBeNull();
    expect(container.textContent).toBe("");
  });

  it("shows Remix Icon's Mastercard logo", () => {
    const { container } = render(<BrandLogo brand="MASTERCARD" />);
    const icon = container.querySelector("[data-brand-logo='MASTERCARD'] i");

    expect(icon).toHaveClass("ri-mastercard-fill");
    expect(icon).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector("svg")).toBeNull();
  });

  it("falls back to a generic credit-card icon for other brands", () => {
    const { container } = render(<BrandLogo brand="OTHER" />);

    expect(
      container.querySelector("[data-brand-logo='OTHER'] svg"),
    ).not.toBeNull();
    expect(container.querySelector("i")).toBeNull();
  });

  it("is decorative and can be sized", () => {
    const { container } = render(<BrandLogo brand="VISA" size="lg" />);
    const logo = container.querySelector("[data-brand-logo]");

    expect(logo).toHaveAttribute("aria-hidden", "true");
    expect(logo).toHaveAttribute("data-size", "lg");
  });

  it("draws the logo bigger in the large size", () => {
    const small = render(<BrandLogo brand="VISA" />).container.querySelector(
      "i",
    );
    const large = render(
      <BrandLogo brand="VISA" size="lg" />,
    ).container.querySelector("i");

    expect(small?.className).not.toBe(large?.className);
  });
});
