import { XMarkIcon } from "@heroicons/react/24/outline";
import { Button } from "@heroui/react";

import { Await } from "@/components/shared/Await";
import type { EntryStatus } from "@/core/entries/status";

import { FIELD_HEIGHT_CLASS_NAME } from "@/components/Entries/styles";
import { DateFilterField } from "./components/DateFilterField";
import { FilterSelect } from "./components/FilterSelect";
import { FilterSelectSkeleton } from "./components/FilterSelectSkeleton";
import {
  ALL_CATEGORIES_LABEL,
  ALL_CURRENCIES_LABEL,
  CATEGORY_LABEL,
  CLEAR_LABEL,
  CURRENCY_LABEL,
  FROM_LABEL,
  PLANNED_LABEL,
  STATUS_LABEL,
  TO_LABEL,
  ALL_STATUSES_LABEL,
} from "./consts";
import {
  CLEAR_ICON_CLASS_NAME,
  DATE_FIELD_CLASS_NAME,
  ROOT_CLASS_NAME,
  SELECT_FIELD_CLASS_NAME,
} from "./styles";
import type { EntriesFiltersProps } from "./types";
import { buildCurrencyOptions } from "./utils";

export function EntriesFilters({
  ariaLabel,
  settledLabel,
  query,
  categories,
  currencies,
  canClear,
  onChange,
  onClear,
}: EntriesFiltersProps) {
  return (
    <div className={ROOT_CLASS_NAME} role="group" aria-label={ariaLabel}>
      <DateFilterField
        label={FROM_LABEL}
        name="from"
        value={query.from}
        className={DATE_FIELD_CLASS_NAME}
        onCommit={(from) => onChange({ from })}
      />
      <DateFilterField
        label={TO_LABEL}
        name="to"
        value={query.to}
        className={DATE_FIELD_CLASS_NAME}
        onCommit={(to) => onChange({ to })}
      />
      <FilterSelect
        label={STATUS_LABEL}
        allLabel={ALL_STATUSES_LABEL}
        options={[
          { id: "PLANNED", label: PLANNED_LABEL },
          { id: "SETTLED", label: settledLabel },
        ]}
        value={query.status}
        className={SELECT_FIELD_CLASS_NAME}
        onChange={(status) =>
          onChange({ status: status as EntryStatus | null })
        }
      />
      <Await
        source={categories}
        fallback={
          <FilterSelectSkeleton
            label={CATEGORY_LABEL}
            className={SELECT_FIELD_CLASS_NAME}
          />
        }
      >
        {(list) => (
          <FilterSelect
            label={CATEGORY_LABEL}
            allLabel={ALL_CATEGORIES_LABEL}
            options={list.map(({ id, name }) => ({ id, label: name }))}
            value={query.categoryId}
            className={SELECT_FIELD_CLASS_NAME}
            onChange={(categoryId) => onChange({ categoryId })}
          />
        )}
      </Await>
      <Await
        source={currencies}
        fallback={
          <FilterSelectSkeleton
            label={CURRENCY_LABEL}
            className={SELECT_FIELD_CLASS_NAME}
          />
        }
      >
        {(codes) => (
          <FilterSelect
            label={CURRENCY_LABEL}
            allLabel={ALL_CURRENCIES_LABEL}
            options={buildCurrencyOptions(codes, query.currency)}
            value={query.currency}
            className={SELECT_FIELD_CLASS_NAME}
            onChange={(currency) => onChange({ currency })}
          />
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
