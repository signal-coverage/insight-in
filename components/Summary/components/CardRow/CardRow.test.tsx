// @vitest-environment jsdom
import { BanknotesIcon } from "@heroicons/react/24/outline";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CardRow } from "./CardRow";

const renderRow = (tone: "income" | "expense" | "balance" = "income") =>
  render(
    <CardRow
      label="Ingresos en ARS"
      title="Ingresos"
      Icon={BanknotesIcon}
      tone={tone}
    >
      <li>una tarjeta</li>
    </CardRow>,
  );

describe("CardRow", () => {
  it("shows its title as a visible heading", () => {
    renderRow();

    expect(
      screen.getByRole("heading", { level: 3, name: "Ingresos" }),
    ).toBeInTheDocument();
  });

  it("puts its cards in a list named for assistive technology", () => {
    renderRow();

    expect(
      screen.getByRole("list", { name: "Ingresos en ARS" }),
    ).toHaveTextContent("una tarjeta");
  });

  it.each(["income", "expense", "balance"] as const)(
    "gives the heading the %s tone",
    (tone) => {
      renderRow(tone);

      expect(screen.getByRole("heading", { name: "Ingresos" })).toHaveAttribute(
        "data-tone",
        tone,
      );
    },
  );

  it("draws its icon as decoration, so the heading's name stays the plain title", () => {
    renderRow();

    const heading = screen.getByRole("heading", { name: "Ingresos" });

    expect(heading.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
  });
});
