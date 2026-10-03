// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));

import { MonthSelector } from "./MonthSelector";

const renderSelector = (month = "2026-08", currentMonth = "2026-09") =>
  render(
    <MonthSelector
      month={month}
      label="Agosto de 2026"
      currentMonth={currentMonth}
    />,
  );

const press = (name: string) =>
  fireEvent.click(screen.getByRole("button", { name }));

beforeEach(() => {
  router.push.mockClear();
});

describe("MonthSelector", () => {
  it("is a navigation named Mes, with the month written out", () => {
    renderSelector();

    expect(screen.getByRole("navigation", { name: "Mes" })).toBeInTheDocument();
    expect(screen.getByText("Agosto de 2026")).toBeInTheDocument();
  });

  it("announces a change of month to assistive technology", () => {
    renderSelector();

    expect(screen.getByText("Agosto de 2026")).toHaveAttribute(
      "aria-live",
      "polite",
    );
  });

  it("goes to the previous month", () => {
    renderSelector();

    press("Mes anterior");

    expect(router.push).toHaveBeenCalledWith(
      "/dashboard/overview?month=2026-07",
    );
  });

  it("goes to the next month", () => {
    renderSelector("2026-03", "2026-09");

    press("Mes siguiente");

    expect(router.push).toHaveBeenCalledWith(
      "/dashboard/overview?month=2026-04",
    );
  });

  it("rolls the year back from January", () => {
    renderSelector("2026-01", "2026-09");

    press("Mes anterior");

    expect(router.push).toHaveBeenCalledWith(
      "/dashboard/overview?month=2025-12",
    );
  });

  it("rolls the year forward from December", () => {
    renderSelector("2026-12", "2026-09");

    press("Mes siguiente");

    expect(router.push).toHaveBeenCalledWith(
      "/dashboard/overview?month=2027-01",
    );
  });

  it("leaves the month out of the address when the next month is the one in course", () => {
    renderSelector("2026-08", "2026-09");

    press("Mes siguiente");

    expect(router.push).toHaveBeenCalledWith("/dashboard/overview");
  });

  describe("on another page", () => {
    const renderOn = (path: string) =>
      render(
        <MonthSelector
          month="2026-08"
          label="Agosto de 2026"
          currentMonth="2026-09"
          basePath={path}
        />,
      );

    it("keeps the month in that page's address", () => {
      renderOn("/dashboard/overview/insights");

      press("Mes anterior");

      expect(router.push).toHaveBeenCalledWith(
        "/dashboard/overview/insights?month=2026-07",
      );
    });

    it("goes back to the bare address of that page", () => {
      renderOn("/dashboard/overview/insights");

      press("Mes actual");

      expect(router.push).toHaveBeenCalledWith("/dashboard/overview/insights");
    });
  });

  describe("the way back to the month in course", () => {
    it("is offered while another month is shown", () => {
      renderSelector("2026-03", "2026-09");

      expect(
        screen.getByRole("button", { name: "Mes actual" }),
      ).toBeInTheDocument();
    });

    it("goes to the bare summary", () => {
      renderSelector("2026-03", "2026-09");

      press("Mes actual");

      expect(router.push).toHaveBeenCalledWith("/dashboard/overview");
    });

    it("is there but disabled while the month in course is shown, since there is nowhere to go back to and the selector keeps its width", () => {
      renderSelector("2026-09", "2026-09");

      expect(screen.getByRole("button", { name: "Mes actual" })).toBeDisabled();
    });

    it("is enabled while another month is shown", () => {
      renderSelector("2026-03", "2026-09");

      expect(screen.getByRole("button", { name: "Mes actual" })).toBeEnabled();
    });
  });
});
