// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatusSwitch } from "./StatusSwitch";

const submitted = (container: HTMLElement): string | null => {
  const form = container.querySelector("form") as HTMLFormElement;

  return new FormData(form).get("status") as string | null;
};

const renderSwitch = (defaultSettled: boolean) =>
  render(
    <form>
      <StatusSwitch defaultSettled={defaultSettled} label="Ya cobrado" />
    </form>,
  );

describe("StatusSwitch", () => {
  it("submits SETTLED when it starts on", () => {
    const { container } = renderSwitch(true);

    expect(screen.getByRole("switch", { name: "Ya cobrado" })).toBeChecked();
    expect(submitted(container)).toBe("SETTLED");
  });

  it("submits PLANNED when it starts off, instead of submitting nothing", () => {
    const { container } = renderSwitch(false);

    expect(
      screen.getByRole("switch", { name: "Ya cobrado" }),
    ).not.toBeChecked();
    expect(submitted(container)).toBe("PLANNED");
  });

  it("follows the switch when it is toggled", () => {
    const { container } = renderSwitch(true);

    fireEvent.click(screen.getByRole("switch", { name: "Ya cobrado" }));

    expect(submitted(container)).toBe("PLANNED");

    fireEvent.click(screen.getByRole("switch", { name: "Ya cobrado" }));

    expect(submitted(container)).toBe("SETTLED");
  });
});
