// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { StatusCheckbox } from "./StatusCheckbox";

const renderBox = (
  isSettled: boolean,
  onChange = vi.fn(),
  isDisabled = false,
) => {
  render(
    <StatusCheckbox
      isSettled={isSettled}
      label="Marcar Sueldo como cobrado"
      isDisabled={isDisabled}
      onChange={onChange}
    />,
  );

  return { onChange };
};

const box = () =>
  screen.getByRole("checkbox", { name: "Marcar Sueldo como cobrado" });

describe("StatusCheckbox", () => {
  it("reflects whether the entry is settled", () => {
    renderBox(true);

    expect(box()).toBeChecked();
  });

  it("is unchecked while the entry is only planned", () => {
    renderBox(false);

    expect(box()).not.toBeChecked();
  });

  it("reports the new state when it is clicked", () => {
    const { onChange } = renderBox(false);

    fireEvent.click(box());

    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("reports unchecking too", () => {
    const { onChange } = renderBox(true);

    fireEvent.click(box());

    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("is disabled while a change is being saved, so it cannot be toggled twice", () => {
    renderBox(false, vi.fn(), true);

    expect(box()).toBeDisabled();
  });
});
