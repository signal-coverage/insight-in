// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { InstallmentPreview } from "./InstallmentPreview";

describe("InstallmentPreview", () => {
  it("shows the live line once there is one, announced politely", () => {
    render(
      <InstallmentPreview text="12 cuotas de $ 100,00 · total $ 1.200,00" />,
    );

    const line = screen.getByText("12 cuotas de $ 100,00 · total $ 1.200,00");

    expect(line).toBeVisible();
    expect(line).toHaveAttribute("aria-live", "polite");
  });

  it("asks to complete the data while there is no line", () => {
    render(<InstallmentPreview text={null} />);

    expect(
      screen.getByText("Completá los datos para ver el detalle de las cuotas."),
    ).toBeVisible();
  });
});
