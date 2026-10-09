import { CreditCardIcon, PlusIcon } from "@heroicons/react/24/outline";

import type { BulkDeleteCopy } from "@/components/Entries/components/BulkDeleteDialog";
import type { EntriesEmptyStateCopy } from "@/components/Entries/components/EntriesEmptyState/types";
import type { ActionsMenuItem } from "@/components/Entries/components/PageHeader";
import { HELP_ACTION_ITEM } from "@/components/Entries/consts";
import type { CardLimitMode } from "@/core/cards/types";

import type { FormTarget } from "./types";

export const PAGE_TITLE = "Tarjetas";
export const PAGE_DESCRIPTION =
  "Tus tarjetas de crédito y débito, y cuánto querés destinarles.";
export const ACTIONS_LABEL = "Acciones";
export const ADD_CARD_LABEL = "Agregar tarjeta";
export const ADD_CARD_ACTION = "add-card";

// What the Actions menu offers, in order.
export const ACTION_ITEMS: readonly ActionsMenuItem[] = [
  { id: ADD_CARD_ACTION, label: ADD_CARD_LABEL, Icon: PlusIcon },
  HELP_ACTION_ITEM,
];

// Said under the table: the cap is the user's to choose.
export const LIMIT_NOTE =
  "El tope puede ser el límite real de la tarjeta o uno menor que quieras respetar.";

// What the dialog asks before deleting the selected cards, and what it says about the ones that were
// left out: a card with a purchase still pending is never deleted.
export const BULK_DELETE_COPY: BulkDeleteCopy = {
  heading: (count) =>
    count === 1 ? "¿Eliminar 1 tarjeta?" : `¿Eliminar ${count} tarjetas?`,
  partialResult: (deleted, skipped) => {
    const left =
      skipped === 1
        ? "No se eliminó 1 tarjeta porque tiene compras pendientes."
        : `No se eliminaron ${skipped} tarjetas porque tienen compras pendientes.`;

    if (deleted === 0) {
      return left;
    }

    const done =
      deleted === 1
        ? "Se eliminó 1 tarjeta."
        : `Se eliminaron ${deleted} tarjetas.`;

    return `${done} ${left}`;
  },
};

export const EMPTY_COPY: EntriesEmptyStateCopy = {
  empty: {
    icon: CreditCardIcon,
    title: "Todavía no tenés tarjetas",
    hint: "Agregá tu primera tarjeta para ver cuánto le podés cargar.",
    action: ADD_CARD_LABEL,
  },
  // A card list is never filtered, so this is never shown.
  filtered: { title: "", hint: "" },
};

// How a cap reads after its amount.
export const LIMIT_MODE_SUFFIXES: Readonly<Record<CardLimitMode, string>> = {
  MONTHLY: "por mes",
  TOTAL: "en total",
};

export const dayLabel = (day: number): string => `Día ${day}`;

// "Visa •••• 1234": the brand written out and the last four digits behind masked ones.
export const cardTitle = (brandName: string, last4: string): string =>
  `${brandName} •••• ${last4}`;

export const INITIAL_FORM_TARGET: FormTarget = { key: 0, card: null };

// What a cell says when the card has nothing there (a debit card's cycle, use and availability).
export const NO_VALUE_LABEL = "—";

// The Tope cell of a debit card whose bank has no active account.
export const NO_ACTIVE_ACCOUNTS_LABEL = "Sin cuentas activas";

// Between the currencies of a debit card: "ARS · USD".
export const CURRENCIES_SEPARATOR = " · ";
