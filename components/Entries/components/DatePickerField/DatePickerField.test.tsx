// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DatePickerField } from "./DatePickerField";

const submittedValue = (form: HTMLFormElement, name: string) =>
  new FormData(form).get(name);

describe("DatePickerField", () => {
  it("renders its label", () => {
    render(<DatePickerField label="Fecha" name="date" />);

    expect(screen.getByText("Fecha")).toBeInTheDocument();
  });

  it("submits the default value as an ISO date under its name", () => {
    const { container } = render(
      <form>
        <DatePickerField label="Fecha" name="date" defaultValue="2026-10-01" />
      </form>,
    );

    expect(submittedValue(container.querySelector("form")!, "date")).toBe(
      "2026-10-01",
    );
  });

  it("submits an empty string when there is no date", () => {
    const { container } = render(
      <form>
        <DatePickerField label="End date" name="endDate" />
      </form>,
    );

    expect(submittedValue(container.querySelector("form")!, "endDate")).toBe(
      "",
    );
  });

  it("ignores a default value that is not a real date instead of crashing", () => {
    const { container } = render(
      <form>
        <DatePickerField label="Fecha" name="date" defaultValue="garbage" />
      </form>,
    );

    expect(submittedValue(container.querySelector("form")!, "date")).toBe("");
  });

  it("shows the description when given", () => {
    render(
      <DatePickerField
        label="Start date"
        name="startDate"
        description="First occurrence"
      />,
    );

    expect(screen.getByText("First occurrence")).toBeInTheDocument();
  });

  it("opens a calendar and reports the picked day as an ISO date", async () => {
    const onChange = vi.fn();

    render(
      <DatePickerField
        label="Fecha"
        name="date"
        defaultValue="2026-10-01"
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /calendar/i }));

    const grid = await screen.findByRole("grid");
    const day = Array.from(grid.querySelectorAll('[role="button"]')).find(
      (cell) =>
        cell.textContent === "15" && !cell.hasAttribute("data-outside-month"),
    );

    expect(day).toBeDefined();
    fireEvent.click(day!);

    await waitFor(() => expect(onChange).toHaveBeenCalledWith("2026-10-15"));
  });

  it("keeps its calendar free of extra buttons: filters are reset by 'Clear filters'", async () => {
    render(
      <DatePickerField label="Fecha" name="date" defaultValue="2026-10-01" />,
    );

    fireEvent.click(screen.getByRole("button", { name: /calendar/i }));
    await screen.findByRole("grid");

    expect(
      screen.queryByRole("button", { name: "Clear" }),
    ).not.toBeInTheDocument();
  });

  it("follows a controlled value and reports it as null when cleared", () => {
    const { container, rerender } = render(
      <form>
        <DatePickerField
          label="Desde"
          name="from"
          value="2026-03-01"
          onChange={() => {}}
        />
      </form>,
    );

    expect(submittedValue(container.querySelector("form")!, "from")).toBe(
      "2026-03-01",
    );

    rerender(
      <form>
        <DatePickerField
          label="Desde"
          name="from"
          value={null}
          onChange={() => {}}
        />
      </form>,
    );

    expect(submittedValue(container.querySelector("form")!, "from")).toBe("");
  });
});
