import { BuildingLibraryIcon, PlusIcon } from "@heroicons/react/24/outline";

import type { ActionsMenuItem } from "@/components/Entries/components/PageHeader";

import type { AccountFormTarget, BankFormTarget } from "./types";

export const PAGE_TITLE = "Bancos";
export const PAGE_DESCRIPTION =
  "Tus bancos, billeteras y efectivo, con las cuentas que tenés en cada uno.";

export const ACTIONS_LABEL = "Acciones";
export const CREATE_BANK_ACTION = "create-bank";
export const CREATE_BANK_LABEL = "Crear banco";
export const CREATE_ACCOUNT_ACTION = "create-account";
export const CREATE_ACCOUNT_LABEL = "Crear cuenta";

// What the Actions menu offers, in order.
export const ACTION_ITEMS: readonly ActionsMenuItem[] = [
  {
    id: CREATE_BANK_ACTION,
    label: CREATE_BANK_LABEL,
    Icon: BuildingLibraryIcon,
  },
  { id: CREATE_ACCOUNT_ACTION, label: CREATE_ACCOUNT_LABEL, Icon: PlusIcon },
];

export const INITIAL_BANK_TARGET: BankFormTarget = { key: 0, bank: null };
export const INITIAL_ACCOUNT_TARGET: AccountFormTarget = {
  key: 0,
  account: null,
  bankId: null,
};
