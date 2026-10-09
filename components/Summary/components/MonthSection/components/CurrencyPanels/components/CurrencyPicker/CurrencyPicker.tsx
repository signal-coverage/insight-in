import { AdjustmentsHorizontalIcon } from "@heroicons/react/24/outline";
import { Checkbox, Popover } from "@heroui/react";

import { InlineAlert } from "@/components/shared/InlineAlert";
import { PendingButton } from "@/components/shared/PendingButton";
import { SavingIndicator } from "@/components/shared/SavingIndicator";
import { saveHiddenSummaryCurrenciesAction } from "@/core/settings/actions";

import {
  DIALOG_DESCRIPTION,
  DIALOG_TITLE,
  LAST_CURRENCY_HINT,
  LAST_CURRENCY_HINT_ID,
  TRIGGER_LABEL,
} from "./consts";
import {
  DESCRIPTION_CLASS_NAME,
  HINT_CLASS_NAME,
  LIST_CLASS_NAME,
  ROOT_CLASS_NAME,
} from "./styles";
import type { CurrencyPickerProps } from "./types";
import { useHiddenCurrencies } from "./useHiddenCurrencies";
import { checkedCurrencies, currencyLabel, nextHidden } from "./utils";

// Chooses which currencies show as tabs in the month block. One box per currency the user has; a box
// saves as soon as it is pressed, so there is no Save button. The last ticked one is locked, so the
// block never runs out of tabs.
export function CurrencyPicker({ currencies, hidden }: CurrencyPickerProps) {
  const {
    hidden: current,
    error,
    isPending,
    change,
  } = useHiddenCurrencies(hidden, saveHiddenSummaryCurrenciesAction);
  const checked = checkedCurrencies(currencies, current);
  const isLastChecked = checked.length === 1;

  return (
    <Popover>
      <PendingButton
        variant="secondary"
        isPending={isPending}
        Icon={AdjustmentsHorizontalIcon}
        label={TRIGGER_LABEL}
      />
      <Popover.Content placement="bottom end">
        <Popover.Dialog>
          <div className={ROOT_CLASS_NAME}>
            <Popover.Heading>{DIALOG_TITLE}</Popover.Heading>
            <p className={DESCRIPTION_CLASS_NAME}>{DIALOG_DESCRIPTION}</p>
            <div className={LIST_CLASS_NAME}>
              {currencies.map((code) => {
                const isLast = isLastChecked && checked[0] === code;

                return (
                  <Checkbox
                    key={code}
                    isSelected={checked.includes(code)}
                    isDisabled={isLast}
                    aria-describedby={
                      isLast ? LAST_CURRENCY_HINT_ID : undefined
                    }
                    onChange={(isSelected) =>
                      change(nextHidden(currencies, current, code, isSelected))
                    }
                  >
                    <Checkbox.Content>
                      <Checkbox.Control>
                        <Checkbox.Indicator />
                      </Checkbox.Control>
                      {currencyLabel(code)}
                    </Checkbox.Content>
                  </Checkbox>
                );
              })}
            </div>
            {isLastChecked ? (
              <p id={LAST_CURRENCY_HINT_ID} className={HINT_CLASS_NAME}>
                {LAST_CURRENCY_HINT}
              </p>
            ) : null}
            {isPending ? <SavingIndicator /> : null}
            {error ? <InlineAlert variant="error">{error}</InlineAlert> : null}
          </div>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
