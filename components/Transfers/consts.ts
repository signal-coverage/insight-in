import { ArrowsRightLeftIcon, PlusIcon } from "@heroicons/react/24/outline";

import type { BulkDeleteCopy } from "@/components/Entries/components/BulkDeleteDialog";
import type { EntriesEmptyStateCopy } from "@/components/Entries/components/EntriesEmptyState/types";
import type { ActionsMenuItem } from "@/components/Entries/components/PageHeader";

import type { FormTarget, TransferFilters } from "./types";

export const PAGE_TITLE = "Transferencias";
export const PAGE_DESCRIPTION =
  "Pasá dinero entre tus cuentas. No cuenta como ingreso ni como gasto.";
export const ACTIONS_LABEL = "Acciones";
export const ADD_TRANSFER_LABEL = "Crear transferencia";
export const ADD_TRANSFER_ACTION = "add-transfer";

// What the Actions menu offers, in order.
export const ACTION_ITEMS: readonly ActionsMenuItem[] = [
  { id: ADD_TRANSFER_ACTION, label: ADD_TRANSFER_LABEL, Icon: PlusIcon },
];

export const NO_FILTERS: TransferFilters = {
  search: "",
  accountId: null,
  currency: null,
};

export const INITIAL_FORM_TARGET: FormTarget = {
  key: 0,
  transfer: null,
  defaultDate: "",
};

// What the dialog asks before deleting the selected transfers.
export const BULK_DELETE_COPY: BulkDeleteCopy = {
  heading: (count) =>
    count === 1
      ? "¿Eliminar 1 transferencia?"
      : `¿Eliminar ${count} transferencias?`,
};

export const EMPTY_COPY: EntriesEmptyStateCopy = {
  empty: {
    icon: ArrowsRightLeftIcon,
    title: "No hay transferencias en este mes",
    hint: "Pasá dinero de una cuenta a otra y se va a reflejar en los saldos, sin contar como ingreso ni como gasto.",
    action: ADD_TRANSFER_LABEL,
  },
  filtered: {
    title: "Ninguna transferencia coincide con estos filtros",
    hint: "Probá cambiando la búsqueda, la cuenta o la moneda.",
  },
};
