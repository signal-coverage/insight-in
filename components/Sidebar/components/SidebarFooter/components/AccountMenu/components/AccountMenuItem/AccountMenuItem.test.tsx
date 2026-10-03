// @vitest-environment jsdom
import { Button, Dropdown } from "@heroui/react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));

import { ACCOUNT_MENU_ENTRIES } from "../../consts";
import type { AccountMenuEntry } from "../../types";
import { AccountMenuItem } from "./AccountMenuItem";

const renderItem = (entry: AccountMenuEntry, onAction?: () => void) =>
  render(
    <Dropdown>
      <Button aria-label="Cuenta">Cuenta</Button>
      <Dropdown.Popover>
        <Dropdown.Menu aria-label="Menú">
          <AccountMenuItem entry={entry} onAction={onAction} />
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>,
  );

const choose = async (name: string) => {
  fireEvent.keyDown(screen.getByRole("button", { name: "Cuenta" }), {
    key: "ArrowDown",
  });

  const item = await screen.findByRole("menuitem", { name });

  fireEvent.keyDown(item, { key: "Enter" });
  fireEvent.keyUp(item, { key: "Enter" });
};

const HELP = ACCOUNT_MENU_ENTRIES.find((entry) => entry.id === "help-center");

const ACCOUNT = ACCOUNT_MENU_ENTRIES.find(
  (entry) => entry.id === "account-settings",
);
const SETTINGS = ACCOUNT_MENU_ENTRIES.find((entry) => entry.id === "settings");

beforeEach(() => {
  router.push.mockReset();
});

describe("the Configuración de la cuenta entry", () => {
  it("leads to the account page", () => {
    expect(ACCOUNT?.label).toBe("Configuración de la cuenta");
    expect(ACCOUNT?.href).toBe("/dashboard/account");
  });

  it("takes the user to the account page when chosen", async () => {
    renderItem(ACCOUNT as AccountMenuEntry);

    await choose("Configuración de la cuenta");

    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith("/dashboard/account");
  });
});

describe("the Configuración entry", () => {
  it("leads to the settings page", () => {
    expect(SETTINGS?.label).toBe("Configuración");
    expect(SETTINGS?.href).toBe("/dashboard/settings");
  });

  it("takes the user to the settings page when chosen", async () => {
    renderItem(SETTINGS as AccountMenuEntry);

    await choose("Configuración");

    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith("/dashboard/settings");
  });
});

describe("the Centro de ayuda entry", () => {
  it("is in the account menu, and leads to the help page", () => {
    expect(HELP?.label).toBe("Centro de ayuda");
    expect(HELP?.href).toBe("/dashboard/help");
  });

  it("takes the user to the help page when chosen", async () => {
    renderItem(HELP as AccountMenuEntry);

    await choose("Centro de ayuda");

    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith("/dashboard/help");
  });
});

describe("AccountMenuItem", () => {
  it("goes nowhere when its entry has no address", async () => {
    const entry = ACCOUNT_MENU_ENTRIES.find((candidate) => !candidate.href);

    renderItem(entry as AccountMenuEntry);

    await choose((entry as AccountMenuEntry).label);

    expect(router.push).not.toHaveBeenCalled();
  });

  it("calls the action it is given, and navigates only when that is what the entry is for", async () => {
    const onAction = vi.fn();

    renderItem({ ...(HELP as AccountMenuEntry), href: undefined }, onAction);

    await choose("Centro de ayuda");

    expect(onAction).toHaveBeenCalledTimes(1);
    expect(router.push).not.toHaveBeenCalled();
  });

  it("leaves Actividad and Integraciones as they were, with no page yet", () => {
    expect(
      ACCOUNT_MENU_ENTRIES.filter((entry) => entry.href).map(
        (entry) => entry.id,
      ),
    ).toEqual(["account-settings", "settings", "help-center"]);
    expect(
      ACCOUNT_MENU_ENTRIES.filter((entry) => !entry.href).map(
        (entry) => entry.label,
      ),
    ).toEqual(["Actividad", "Integraciones"]);
  });
});
