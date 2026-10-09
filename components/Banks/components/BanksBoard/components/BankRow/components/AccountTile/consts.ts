import type { BoardAccount } from "@/core/banks/types";

export const ARCHIVED_ACCOUNT_LABEL = "Archivada";

// The accessible name replaces what the tile shows, so it carries it all: the currency, the balance
// and whether the account is archived.
export const editAccountLabel = ({
  name,
  currency,
  archived,
  balanceLabel,
}: Pick<
  BoardAccount,
  "name" | "currency" | "archived" | "balanceLabel"
>): string =>
  `Editar cuenta ${name}, ${currency}, saldo ${balanceLabel}${archived ? ", archivada" : ""}`;
