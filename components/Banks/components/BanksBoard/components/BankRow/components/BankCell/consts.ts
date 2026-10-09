import type { Bank } from "@/core/banks/types";

export const ARCHIVED_BANK_LABEL = "Archivado";

export const WALLET_BANK_LABEL = "Billetera";

// The accessible name replaces the visible chips, so it carries whether the bank is a virtual wallet
// and whether it is archived.
export const editBankLabel = ({
  name,
  kind,
  archived,
}: Pick<Bank, "name" | "kind" | "archived">): string =>
  `Editar banco ${name}${kind === "WALLET" ? ", billetera virtual" : ""}${archived ? ", archivado" : ""}`;
