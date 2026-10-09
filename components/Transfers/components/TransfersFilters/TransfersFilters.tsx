import { XMarkIcon } from "@heroicons/react/24/outline";
import { Button, SearchField } from "@heroui/react";

import { FilterSelect } from "@/components/Entries/components/EntriesFilters/components/FilterSelect";
import { FilterSelectSkeleton } from "@/components/Entries/components/EntriesFilters/components/FilterSelectSkeleton";
import { buildCurrencyOptions } from "@/components/Entries/components/EntriesFilters/utils";
import {
  FIELD_HEIGHT_CLASS_NAME,
  FIELD_VARIANT,
} from "@/components/Entries/styles";
import { Await } from "@/components/shared/Await";

import {
  ACCOUNT_LABEL,
  ALL_ACCOUNTS_LABEL,
  ALL_CURRENCIES_LABEL,
  CLEAR_LABEL,
  CURRENCY_LABEL,
  FILTERS_LABEL,
  SEARCH_LABEL,
  SEARCH_PLACEHOLDER,
} from "./consts";
import {
  CLEAR_ICON_CLASS_NAME,
  ROOT_CLASS_NAME,
  SEARCH_CLASS_NAME,
  SELECT_FIELD_CLASS_NAME,
} from "./styles";
import type { TransfersFiltersProps } from "./types";
import { accountOptions, currencyCodes } from "./utils";

// What narrows the month's list: a search over the accounts and the notes, an account on either side
// and a currency. All of them are controlled by the page, which applies them to the rows.
export function TransfersFilters({
  filters,
  accounts,
  canClear,
  onChange,
  onClear,
}: TransfersFiltersProps) {
  return (
    <div className={ROOT_CLASS_NAME} role="group" aria-label={FILTERS_LABEL}>
      <SearchField
        aria-label={SEARCH_LABEL}
        variant={FIELD_VARIANT}
        className={SEARCH_CLASS_NAME}
        value={filters.search}
        onChange={(search) => onChange({ search })}
      >
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input placeholder={SEARCH_PLACEHOLDER} />
          <SearchField.ClearButton />
        </SearchField.Group>
      </SearchField>
      <Await
        source={accounts}
        fallback={
          <>
            <FilterSelectSkeleton
              label={ACCOUNT_LABEL}
              className={SELECT_FIELD_CLASS_NAME}
            />
            <FilterSelectSkeleton
              label={CURRENCY_LABEL}
              className={SELECT_FIELD_CLASS_NAME}
            />
          </>
        }
      >
        {(list) => (
          <>
            <FilterSelect
              label={ACCOUNT_LABEL}
              allLabel={ALL_ACCOUNTS_LABEL}
              options={accountOptions(list)}
              value={filters.accountId}
              className={SELECT_FIELD_CLASS_NAME}
              onChange={(accountId) => onChange({ accountId })}
            />
            <FilterSelect
              label={CURRENCY_LABEL}
              allLabel={ALL_CURRENCIES_LABEL}
              options={buildCurrencyOptions(
                currencyCodes(list),
                filters.currency,
              )}
              value={filters.currency}
              className={SELECT_FIELD_CLASS_NAME}
              onChange={(currency) => onChange({ currency })}
            />
          </>
        )}
      </Await>
      {canClear ? (
        <Button
          className={FIELD_HEIGHT_CLASS_NAME}
          variant="tertiary"
          onPress={onClear}
        >
          <XMarkIcon className={CLEAR_ICON_CLASS_NAME} aria-hidden="true" />
          {CLEAR_LABEL}
        </Button>
      ) : null}
    </div>
  );
}
