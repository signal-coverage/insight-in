// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RecurringNotice } from "./RecurringNotice";

describe("RecurringNotice", () => {
  it("says how many recurring expenses are waiting, in the singular for one", () => {
    render(<RecurringNotice pendingCount={1} onResolve={() => {}} />);

    expect(
      screen.getByText("Tenés 1 gasto recurrente sin resolver este mes."),
    ).toBeInTheDocument();
  });

  it("says how many are waiting, in the plural for several", () => {
    render(<RecurringNotice pendingCount={3} onResolve={() => {}} />);

    expect(
      screen.getByText("Tenés 3 gastos recurrentes sin resolver este mes."),
    ).toBeInTheDocument();
  });

  it("is a status message, not an alert that interrupts", () => {
    render(<RecurringNotice pendingCount={2} onResolve={() => {}} />);

    expect(screen.getByRole("status")).toHaveTextContent("sin resolver");
  });

  it("opens the wizard from the Resolve button", () => {
    const onResolve = vi.fn();

    render(<RecurringNotice pendingCount={2} onResolve={onResolve} />);
    fireEvent.click(screen.getByRole("button", { name: "Resolver" }));

    expect(onResolve).toHaveBeenCalledTimes(1);
  });

  it("shows nothing when there is nothing to resolve", () => {
    const { container } = render(
      <RecurringNotice pendingCount={0} onResolve={() => {}} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
