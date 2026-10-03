// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MediumField } from "./MediumField";

const renderField = (
  defaultMedium: "DIGITAL" | "CASH",
  onChange?: (medium: "DIGITAL" | "CASH") => void,
) =>
  render(
    <form aria-label="form">
      <MediumField defaultMedium={defaultMedium} onChange={onChange} />
    </form>,
  );

const submitted = () =>
  new FormData(screen.getByRole("form", { name: "form" }) as HTMLFormElement);

describe("MediumField", () => {
  it("is a group named Medio with the two ways money moves", () => {
    renderField("DIGITAL");

    const group = screen.getByRole("radiogroup", { name: "Medio" });

    expect(group).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Digital" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Efectivo" })).toBeInTheDocument();
  });

  it("starts on the medium it is given: digital", () => {
    renderField("DIGITAL");

    expect(screen.getByRole("radio", { name: "Digital" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Efectivo" })).not.toBeChecked();
  });

  it("starts on cash when the stored medium is cash", () => {
    renderField("CASH");

    expect(screen.getByRole("radio", { name: "Efectivo" })).toBeChecked();
  });

  it("submits the medium with the form, as DIGITAL by default", () => {
    renderField("DIGITAL");

    expect(submitted().get("medium")).toBe("DIGITAL");
  });

  it("tells the parent about the medium that gets chosen", () => {
    const onChange = vi.fn();

    renderField("DIGITAL", onChange);
    fireEvent.click(screen.getByRole("radio", { name: "Efectivo" }));

    expect(onChange).toHaveBeenCalledWith("CASH");
  });

  it("submits CASH once cash is chosen", () => {
    renderField("DIGITAL");

    fireEvent.click(screen.getByRole("radio", { name: "Efectivo" }));

    expect(screen.getByRole("radio", { name: "Efectivo" })).toBeChecked();
    expect(submitted().get("medium")).toBe("CASH");
  });
});
