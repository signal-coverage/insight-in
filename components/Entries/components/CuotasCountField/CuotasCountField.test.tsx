// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CuotasCountField } from "./CuotasCountField";

const input = () => screen.getByRole("textbox", { name: /Cantidad de cuotas/ });

describe("CuotasCountField", () => {
  it("asks for the number of cuotas and says the range", () => {
    render(<CuotasCountField value={12} onChange={() => {}} />);

    expect(input()).toHaveValue("12");
    expect(screen.getByText("De 2 a 60 cuotas, una por mes.")).toBeVisible();
  });

  it("clamps what is typed to 2..60", () => {
    const onChange = vi.fn();

    render(<CuotasCountField value={12} onChange={onChange} />);

    fireEvent.change(input(), { target: { value: "90" } });
    fireEvent.blur(input());
    expect(onChange).toHaveBeenLastCalledWith(60);

    fireEvent.change(input(), { target: { value: "1" } });
    fireEvent.blur(input());
    expect(onChange).toHaveBeenLastCalledWith(2);
  });

  it("steps one at a time with the buttons", () => {
    const onChange = vi.fn();

    render(<CuotasCountField value={12} onChange={onChange} />);

    // The stepper's buttons are the decrement and the increment, in that order.
    fireEvent.click(screen.getAllByRole("button")[1]);
    expect(onChange).toHaveBeenLastCalledWith(13);
  });

  it("reports an emptied field as no number yet", () => {
    const onChange = vi.fn();

    render(<CuotasCountField value={12} onChange={onChange} />);

    fireEvent.change(input(), { target: { value: "" } });
    fireEvent.blur(input());

    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it("shows an empty field while there is no number", () => {
    render(<CuotasCountField value={null} onChange={() => {}} />);

    expect(input()).toHaveValue("");
  });
});
