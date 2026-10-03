// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { DeleteScope } from "@/components/Entries/types";

import { InstallmentDeleteChoice } from "./InstallmentDeleteChoice";
import type { InstallmentDeleteChoiceProps } from "./types";

const renderChoice = (patch: Partial<InstallmentDeleteChoiceProps> = {}) => {
  const onScopeChange = vi.fn<(scope: DeleteScope) => void>();
  const onAcknowledgedChange = vi.fn();

  render(
    <InstallmentDeleteChoice
      side="expense"
      progress={{ total: 12, settled: 3 }}
      scope="entry"
      onScopeChange={onScopeChange}
      acknowledged={false}
      onAcknowledgedChange={onAcknowledgedChange}
      isDisabled={false}
      {...patch}
    />,
  );

  return { onScopeChange, onAcknowledgedChange };
};

describe("InstallmentDeleteChoice", () => {
  it("offers 'solo esta cuota' (selected) and 'el plan completo'", () => {
    renderChoice();

    expect(
      screen.getByRole("radio", { name: /Eliminar solo esta cuota/ }),
    ).toBeChecked();
    expect(
      screen.getByRole("radio", { name: /Eliminar el plan completo/ }),
    ).not.toBeChecked();
  });

  it("says how many cuotas the plan option removes", () => {
    renderChoice();

    expect(
      screen.getByText("Se eliminan las 12 cuotas del plan."),
    ).toBeVisible();
  });

  it("asks nothing and warns nothing while only the cuota is chosen", () => {
    renderChoice();

    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByText(/Este plan tiene/)).toBeNull();
  });

  it("reports the plan option when it is picked", () => {
    const { onScopeChange } = renderChoice();

    fireEvent.click(
      screen.getByRole("radio", { name: /Eliminar el plan completo/ }),
    );

    expect(onScopeChange).toHaveBeenCalledWith("plan");
  });

  it("with the plan chosen, states the total and the paid cuotas, and asks for an explicit acknowledgement", () => {
    const { onAcknowledgedChange } = renderChoice({ scope: "plan" });

    expect(
      screen.getByText(
        /Este plan tiene 12 cuotas en total y 3 ya marcadas como pagadas\./,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /se pierde ese historial y cambian tus saldos y totales/,
      ),
    ).toBeInTheDocument();

    const checkbox = screen.getByRole("checkbox", {
      name: /Entiendo que se eliminan todas las cuotas del plan/,
    });

    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);

    expect(onAcknowledgedChange).toHaveBeenCalledWith(true);
  });

  it("calls the settled cuotas of a loan 'cobradas'", () => {
    renderChoice({
      side: "income",
      scope: "plan",
      progress: { total: 6, settled: 2 },
    });

    expect(
      screen.getByText(
        /Este plan tiene 6 cuotas en total y 2 ya marcadas como cobradas\./,
      ),
    ).toBeInTheDocument();
  });

  it("says so when no cuota is settled yet, without talking about lost history", () => {
    renderChoice({ scope: "plan", progress: { total: 4, settled: 0 } });

    expect(
      screen.getByText(
        "Este plan tiene 4 cuotas en total y ninguna marcada como pagada.",
      ),
    ).toBeInTheDocument();
  });

  it("uses the singular for one settled cuota and for a plan with one cuota left", () => {
    renderChoice({ scope: "plan", progress: { total: 1, settled: 1 } });

    expect(
      screen.getByText(
        /Este plan tiene 1 cuota en total y 1 ya marcada como pagada\./,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Se elimina la única cuota que queda del plan."),
    ).toBeInTheDocument();
  });

  it("locks every control while the delete runs", () => {
    renderChoice({ scope: "plan", isDisabled: true });

    screen
      .getAllByRole("radio")
      .forEach((radio) => expect(radio).toBeDisabled());
    expect(screen.getByRole("checkbox")).toBeDisabled();
  });
});
