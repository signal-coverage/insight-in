import type { BankKind } from "./types";

export const BANKS_PATH = "/dashboard/banks";

// Same limit as the names of the categories.
export const BANK_NAME_MAX_LENGTH = 40;

// ENTITY: a bank (or the cash), legal tender only. WALLET: a virtual wallet, which may also hold the
// crypto assets of the registry.
export const BANK_KINDS = ["ENTITY", "WALLET"] as const;

// What a new bank is when nobody says otherwise (and what the migration made every existing bank).
export const DEFAULT_BANK_KIND: BankKind = "ENTITY";

export const BANK_KIND_NAMES: Readonly<Record<BankKind, string>> = {
  ENTITY: "Entidad bancaria",
  WALLET: "Billetera virtual",
};

export const BANK_FORM_FIELDS = ["name", "kind"] as const;

export const BANK_NOT_FOUND_MESSAGE = "No se encontró el banco.";
export const DUPLICATE_BANK_MESSAGE = "Ya tenés un banco con este nombre.";
// Said when an account is created in, or brought back under, a bank that is archived.
export const BANK_ARCHIVED_MESSAGE =
  "Este banco está archivado. Reactivalo primero.";

export const bankHasActiveAccountsMessage = (count: number): string =>
  count === 1
    ? "Este banco todavía tiene 1 cuenta activa. Archivala primero."
    : `Este banco todavía tiene ${count} cuentas activas. Archivalas primero.`;

export const bankHasAccountsMessage = (count: number): string =>
  count === 1
    ? "Este banco todavía tiene 1 cuenta (archivadas incluidas). Eliminala primero."
    : `Este banco todavía tiene ${count} cuentas (archivadas incluidas). Eliminalas primero.`;

export const bankHasCardsMessage = (count: number): string =>
  count === 1
    ? "Este banco todavía tiene 1 tarjeta. Eliminala primero."
    : `Este banco todavía tiene ${count} tarjetas. Eliminalas primero.`;

export const BANK_KIND_REQUIRED_MESSAGE = "Elegí el tipo de banco.";

// Said under "Tipo" when a wallet that still has crypto accounts is asked to become an entity. Archived
// accounts count too, so archiving them does not help: they have to be deleted.
export const BANK_HAS_CRYPTO_ACCOUNTS_MESSAGE =
  "Este banco tiene cuentas cripto (archivadas incluidas). Eliminalas antes de pasarlo a entidad bancaria.";
