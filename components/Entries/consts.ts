import { QuestionMarkCircleIcon } from "@heroicons/react/24/outline";

import type { ActionsMenuItem } from "@/components/Entries/components/PageHeader";

// The last item of the Actions menu of every page with markers in its table: it leads to the help page
// that explains each icon.
export const HELP_ACTION = "help";
export const HELP_ACTION_ITEM: ActionsMenuItem = {
  id: HELP_ACTION,
  label: "Ayuda de íconos",
  Icon: QuestionMarkCircleIcon,
};

// Accessible names of the per-row buttons, shared by every list of entries.
export const editLabel = (description: string): string =>
  `Editar ${description}`;
export const deleteLabel = (description: string): string =>
  `Eliminar ${description}`;

// The checkbox column of the tables. The header checkbox selects the rows of the page, which is
// all the table ever holds.
export const SELECT_ALL_LABEL = "Seleccionar todas las filas de esta página";
export const selectLabel = (description: string): string =>
  `Seleccionar ${description}`;

// Announced while rows are being deleted, until the refreshed rows arrive.
export const DELETING_LABEL = "Eliminando…";

// The words between an origin and the rate that net / origin implies ("... · cotización 1.200,00").
export const RATE_PREFIX = "cotización";

// Said before the amount of an installment when the total does not divide evenly: the real amount of
// each one is up to whoever charges (or pays) it.
export const APPROXIMATE_PREFIX = "≈";

// "3 de 12 · quedan 9": the installments already paid (or collected) or covered, over the total, and
// what is left.
export const installmentProgressLabel = (
  done: number,
  total: number,
  pending: number,
): string =>
  `${done} de ${total} · ${pending === 1 ? "queda" : "quedan"} ${pending}`;
