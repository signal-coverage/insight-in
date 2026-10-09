// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Help } from "./Help";
import { LEGEND_GROUPS } from "./legend";

describe("Help page", () => {
  it("is titled Ayuda and says what it is for", () => {
    render(<Help />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Ayuda" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Qué significa cada ícono y color de la app."),
    ).toBeInTheDocument();
  });

  it("groups the legend under three headings, in order", () => {
    render(<Help />);

    expect(
      screen
        .getAllByRole("heading", { level: 2 })
        .map((heading) => heading.textContent),
    ).toEqual([
      "Íconos junto a la descripción",
      "Estado y tarjetas",
      "Botones y colores",
    ]);
  });

  it("lists every legend entry with its name, its explanation and where it shows up", () => {
    render(<Help />);

    for (const group of LEGEND_GROUPS) {
      const section = screen.getByRole("region", { name: group.title });

      for (const entry of group.entries) {
        const item = within(section)
          .getByRole("heading", { level: 3, name: entry.name })
          .closest("li");

        expect(item).toHaveTextContent(entry.description);
        expect(item).toHaveTextContent(
          `Aparece en: ${entry.appearsIn.join(", ")}`,
        );
      }
    }
  });

  it("explains the markers in simple words", () => {
    render(<Help />);

    // The cash marker is gone (the account column says where the money is), so the legend no longer
    // explains it.
    expect(
      screen.queryByText(
        "El dinero se pagó o se cobró en efectivo, no por una cuenta.",
      ),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "La pagó otra persona. No se descuenta de tu plata ni cuenta en los totales.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(
        "Guarda el monto en la otra moneda como referencia, con la cotización. Los totales usan solo el monto de la columna Monto.",
      ),
    ).toHaveLength(2);
  });

  it("draws every icon as decoration: the name next to it is what says what it is", () => {
    const { container } = render(<Help />);

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(container.querySelectorAll("li svg").length).toBeGreaterThan(10);

    for (const icon of container.querySelectorAll("li svg")) {
      expect(icon).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("is a single main landmark with no interactive controls", () => {
    render(<Help />);

    expect(screen.getAllByRole("main")).toHaveLength(1);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
