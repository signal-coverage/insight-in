import { ARCHIVED_ACCOUNT_SUFFIX } from "./consts";

// "Caja de ahorro (ARS)", or "Vieja (USD) · archivada". Kept apart from the drawer (and its
// barrel) so the server-side summary mapping can use it without pulling the client drawer, or the
// database client behind its save action, into its module graph.
export const openingRowLabel = (
  accountName: string,
  currency: string,
  archived: boolean,
): string =>
  `${accountName} (${currency})${archived ? ARCHIVED_ACCOUNT_SUFFIX : ""}`;
