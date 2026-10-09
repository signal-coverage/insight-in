import { PlusIcon } from "@heroicons/react/24/outline";
import { Button } from "@heroui/react";

import { LimitRow } from "./components/LimitRow";
import { ADD_LIMIT_LABEL, LIMITS_HINT, LIMITS_LABEL } from "./consts";
import {
  ERROR_CLASS_NAME,
  HINT_CLASS_NAME,
  ICON_CLASS_NAME,
  LEGEND_CLASS_NAME,
  ROOT_CLASS_NAME,
} from "./styles";
import type { LimitsFieldProps } from "./types";
import { useLimitRows } from "./useLimitRows";
import { currencyChoices } from "./utils";

// The caps of a credit card, one per currency: at least one (the last one cannot be removed), never
// two in the same currency (a row only offers the currencies no other row uses). The server's errors
// land on the row they are about, by position, or under the list.
export function LimitsField({ defaultLimits, fieldErrors }: LimitsFieldProps) {
  const { rows, add, remove, change, canAdd } = useLimitRows(defaultLimits);
  const listError = fieldErrors.limits?.[0];

  return (
    <fieldset className={ROOT_CLASS_NAME}>
      <legend className={LEGEND_CLASS_NAME}>{LIMITS_LABEL}</legend>
      <p className={HINT_CLASS_NAME}>{LIMITS_HINT}</p>
      {rows.map((row, index) => (
        <LimitRow
          key={row.key}
          row={row}
          currencies={currencyChoices(rows, index)}
          canRemove={rows.length > 1}
          currencyError={fieldErrors[`limits.${index}.currency`]?.[0]}
          amountError={fieldErrors[`limits.${index}.amount`]?.[0]}
          onChange={(patch) => change(row.key, patch)}
          onRemove={() => remove(row.key)}
        />
      ))}
      {listError ? (
        <p role="alert" className={ERROR_CLASS_NAME}>
          {listError}
        </p>
      ) : null}
      <Button variant="secondary" size="sm" isDisabled={!canAdd} onPress={add}>
        <PlusIcon className={ICON_CLASS_NAME} aria-hidden="true" />
        {ADD_LIMIT_LABEL}
      </Button>
    </fieldset>
  );
}
