// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  saveIncludeExpectedIncomesAction: vi.fn(),
  setTheme: vi.fn(),
}));

vi.mock("@/core/settings/actions", () => ({
  saveIncludeExpectedIncomesAction: mocks.saveIncludeExpectedIncomesAction,
}));
vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "light", setTheme: mocks.setTheme }),
}));

import { THEMES } from "@/lib/themes";

import { Settings } from "./Settings";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.saveIncludeExpectedIncomesAction.mockResolvedValue({
    status: "success",
  });
});

describe("Settings page", () => {
  it("is titled Configuración and says what it is for", () => {
    render(<Settings includeExpectedIncomes />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Configuración" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Preferencias de la aplicación."),
    ).toBeInTheDocument();
  });

  it("has two sections, Resumen and Apariencia, in that order", () => {
    render(<Settings includeExpectedIncomes />);

    expect(
      screen
        .getAllByRole("heading", { level: 2 })
        .map((heading) => heading.textContent),
    ).toEqual(["Resumen", "Apariencia"]);
    expect(screen.getAllByRole("main")).toHaveLength(1);
  });

  it("describes the appearance section in Spanish", () => {
    render(<Settings includeExpectedIncomes />);

    expect(
      screen.getByText("Elegí el tema de la app. Se aplica al instante."),
    ).toBeInTheDocument();
  });
});

describe("Settings page, Resumen section", () => {
  const summary = () => screen.getByRole("region", { name: "Resumen" });

  it("holds the summary's own switch, Sumar ingresos por cobrar, with its description", () => {
    render(<Settings includeExpectedIncomes />);

    expect(
      within(summary()).getByRole("switch", {
        name: /Sumar ingresos por cobrar/,
      }),
    ).toBeInTheDocument();
    expect(
      within(summary()).getByText(
        "Si lo apagás, el remanente objetivo solo resta lo que falta pagar.",
      ),
    ).toBeInTheDocument();
  });

  it.each([true, false])("shows the saved value, %s", (saved) => {
    render(<Settings includeExpectedIncomes={saved} />);

    const toggle = within(summary()).getByRole("switch");

    if (saved) {
      expect(toggle).toBeChecked();
    } else {
      expect(toggle).not.toBeChecked();
    }
  });

  it("saves through the same action the summary page uses", () => {
    render(<Settings includeExpectedIncomes />);

    fireEvent.click(within(summary()).getByRole("switch"));

    expect(mocks.saveIncludeExpectedIncomesAction).toHaveBeenCalledTimes(1);
    expect(mocks.saveIncludeExpectedIncomesAction).toHaveBeenCalledWith(false);
  });

  it("shows a placeholder while the saved value is on its way, and not the switch", () => {
    render(<Settings includeExpectedIncomes={new Promise(() => {})} />);

    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Configuración" }),
    ).toBeVisible();
  });
});

describe("Settings page, Apariencia section", () => {
  const appearance = () => screen.getByRole("region", { name: "Apariencia" });

  it("lists every theme of the app to choose from", () => {
    render(<Settings includeExpectedIncomes />);

    expect(
      within(appearance())
        .getAllByRole("radio")
        .map((radio) => radio.closest("label")?.textContent),
    ).toEqual(THEMES.map((theme) => theme.label));
  });

  it("applies a theme as soon as it is chosen", () => {
    render(<Settings includeExpectedIncomes />);

    fireEvent.click(
      within(appearance()).getByRole("radio", { name: "Modo oscuro" }),
    );

    expect(mocks.setTheme).toHaveBeenCalledWith("dark");
  });
});
