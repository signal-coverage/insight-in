// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// A stand-in for the real picker, so this file tests only the draft/commit logic of the filter
// field. The picker itself (segments, calendar, Clear) is covered by its own tests.
const picker = vi.hoisted(() => ({
  props: null as null | {
    label: string;
    name?: string;
    value?: string | null;
    onChange?: (value: string | null) => void;
  },
}));

vi.mock("../../../DatePickerField", () => ({
  DatePickerField: (props: NonNullable<typeof picker.props>) => {
    picker.props = props;

    return (
      <div data-testid="picker">{`${props.label}|${String(props.value)}`}</div>
    );
  },
}));

import { DateFilterField } from "./DateFilterField";

const type = (value: string | null) =>
  act(() => picker.props!.onChange!(value));

const renderField = (value: string | null = null) => {
  const onCommit = vi.fn();
  const utils = render(
    <DateFilterField
      label="Desde"
      name="from"
      value={value}
      className="w-full"
      onCommit={onCommit}
    />,
  );

  return { onCommit, ...utils };
};

beforeEach(() => {
  picker.props = null;
});

describe("DateFilterField", () => {
  it("passes its label, name and committed value to the picker", () => {
    renderField("2026-01-01");

    expect(picker.props?.name).toBe("from");
    expect(screen.getByTestId("picker")).toHaveTextContent("Desde|2026-01-01");
  });

  it("commits a complete date", () => {
    const { onCommit } = renderField();

    type("2026-01-15");

    expect(onCommit).toHaveBeenCalledWith("2026-01-15");
  });

  it("does not commit while the year is still being typed, but keeps what was typed", () => {
    const { onCommit } = renderField();

    type("0002-01-15");

    expect(onCommit).not.toHaveBeenCalled();
    // The picker is controlled: it must get the draft back or it would snap the digit away.
    expect(screen.getByTestId("picker")).toHaveTextContent("Desde|0002-01-15");

    type("0202-01-15");
    expect(onCommit).not.toHaveBeenCalled();

    type("2026-01-15");
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith("2026-01-15");
  });

  it("commits null when the date is cleared", () => {
    const { onCommit } = renderField("2026-01-01");

    type(null);

    expect(onCommit).toHaveBeenCalledWith(null);
  });

  it("does not commit a value equal to the one already committed", () => {
    const { onCommit } = renderField("2026-01-01");

    type("2026-01-01");

    expect(onCommit).not.toHaveBeenCalled();
  });

  it("follows the committed value when it changes from outside (back button, Clear filters)", () => {
    const { rerender } = renderField("2026-01-01");

    rerender(
      <DateFilterField
        label="Desde"
        name="from"
        value={null}
        className="w-full"
        onCommit={() => {}}
      />,
    );

    expect(screen.getByTestId("picker")).toHaveTextContent("Desde|null");
  });
});
