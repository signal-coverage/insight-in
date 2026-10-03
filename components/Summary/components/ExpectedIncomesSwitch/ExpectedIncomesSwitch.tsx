import { Description, Switch } from "@heroui/react";

import { InlineAlert } from "@/components/shared/InlineAlert";
import { saveIncludeExpectedIncomesAction } from "@/core/settings/actions";

import { SWITCH_DESCRIPTION, SWITCH_LABEL } from "./consts";
import { ROOT_CLASS_NAME } from "./styles";
import type { ExpectedIncomesSwitchProps } from "./types";
import { useOptimisticSetting } from "./useOptimisticSetting";

// Whether the target remainder counts the incomes still to collect. It answers at once and saves in
// the background; the summary's numbers refresh when the save is done.
export function ExpectedIncomesSwitch({
  isSelected,
}: ExpectedIncomesSwitchProps) {
  const { value, error, change } = useOptimisticSetting(
    isSelected,
    saveIncludeExpectedIncomesAction,
  );

  return (
    <div className={ROOT_CLASS_NAME}>
      <Switch isSelected={value} onChange={change}>
        <Switch.Content>
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
          {SWITCH_LABEL}
        </Switch.Content>
        <Description>{SWITCH_DESCRIPTION}</Description>
      </Switch>
      {error ? <InlineAlert variant="error">{error}</InlineAlert> : null}
    </div>
  );
}
