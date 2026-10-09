import { CurrencyAccountsCard } from "./components/CurrencyAccountsCard";
import { SECTION_HINT, SECTION_TITLE } from "./consts";
import {
  HEADING_CLASS_NAME,
  HINT_CLASS_NAME,
  LIST_CLASS_NAME,
  ROOT_CLASS_NAME,
} from "./styles";
import type { AccountsSectionProps } from "./types";

// The balance of each account, grouped by bank, one card per currency (currencies are never added
// together). It is the same figure the Banks board shows, as of today.
export function AccountsSection({ rows }: AccountsSectionProps) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <section className={ROOT_CLASS_NAME} aria-labelledby="accounts-heading">
      <h2 id="accounts-heading" className={HEADING_CLASS_NAME}>
        {SECTION_TITLE}
      </h2>
      <p className={HINT_CLASS_NAME}>{SECTION_HINT}</p>
      <div className={LIST_CLASS_NAME}>
        {rows.map((row) => (
          <CurrencyAccountsCard key={row.currency} row={row} />
        ))}
      </div>
    </section>
  );
}
