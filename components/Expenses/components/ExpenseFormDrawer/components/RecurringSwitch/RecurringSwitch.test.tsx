// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RecurringSwitch } from "./RecurringSwitch";

const submitted = (container: HTMLElement): string | null => {
  const form = container.querySelector("form") as HTMLFormElement;

  return new FormData(form).get("isRecurring") as string | null;
};

const HINT = "Para dejar de repetirlo, usá Gastos recurrentes y elegí Quitar.";

const renderSwitch = (defaultRecurring: boolean, lockedHint?: string) =>
  render(
    <form>
      <RecurringSwitch
        defaultRecurring={defaultRecurring}
        label="Gasto recurrente"
        lockedHint={lockedHint}
      />
    </form>,
  );

describe("RecurringSwitch", () => {
  it("submits 'false' when it starts off, instead of submitting nothing", () => {
    const { container } = renderSwitch(false);

    expect(
      screen.getByRole("switch", { name: "Gasto recurrente" }),
    ).not.toBeChecked();
    expect(submitted(container)).toBe("false");
  });

  it("submits 'true' when it starts on", () => {
    const { container } = renderSwitch(true);

    expect(
      screen.getByRole("switch", { name: "Gasto recurrente" }),
    ).toBeChecked();
    expect(submitted(container)).toBe("true");
  });

  it("follows the switch when it is toggled", () => {
    const { container } = renderSwitch(false);

    fireEvent.click(screen.getByRole("switch", { name: "Gasto recurrente" }));

    expect(submitted(container)).toBe("true");
  });

  it("shows no hint and stays usable when it is not locked", () => {
    renderSwitch(true);

    expect(
      screen.getByRole("switch", { name: "Gasto recurrente" }),
    ).toBeEnabled();
    expect(screen.queryByText(HINT)).not.toBeInTheDocument();
  });

  describe("when the expense already belongs to a recurring template", () => {
    it("is on and cannot be changed, with the hint on how to stop the repetition", () => {
      renderSwitch(true, HINT);

      const toggle = screen.getByRole("switch", { name: "Gasto recurrente" });

      expect(toggle).toBeChecked();
      expect(toggle).toBeDisabled();
      expect(screen.getByText(HINT)).toBeInTheDocument();
    });

    it("keeps submitting 'true', so the form never asks to undo the link", () => {
      const { container } = renderSwitch(true, HINT);

      fireEvent.click(screen.getByRole("switch", { name: "Gasto recurrente" }));

      expect(submitted(container)).toBe("true");
    });

    it("describes the switch with the hint for assistive technology", () => {
      renderSwitch(true, HINT);

      const toggle = screen.getByRole("switch", { name: "Gasto recurrente" });
      const describedBy = toggle.getAttribute("aria-describedby") ?? "";

      expect(
        describedBy
          .split(" ")
          .some((id) => document.getElementById(id)?.textContent === HINT),
      ).toBe(true);
    });
  });
});
