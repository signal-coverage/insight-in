import { Checkbox, Description, Radio, RadioGroup } from "@heroui/react";

import type { DeleteScope } from "@/components/Entries/types";
import { InlineAlert } from "@/components/shared/InlineAlert";

import {
  ACKNOWLEDGE_LABEL,
  ENTRY_OPTION_HINT,
  ENTRY_OPTION_LABEL,
  PLAN_OPTION_LABEL,
  SCOPE_LABEL,
  planOptionHint,
  planWarning,
} from "./consts";
import { ACKNOWLEDGE_CLASS_NAME, ROOT_CLASS_NAME } from "./styles";
import type { InstallmentDeleteChoiceProps } from "./types";

// The part of the delete dialog of an installment that lets the user choose between deleting only that
// cuota and deleting the whole plan. Choosing the plan shows exactly how many cuotas go away (and how
// many are already settled) and asks for an explicit acknowledgement, so it cannot happen by accident.
export function InstallmentDeleteChoice({
  side,
  progress,
  scope,
  onScopeChange,
  acknowledged,
  onAcknowledgedChange,
  isDisabled,
}: InstallmentDeleteChoiceProps) {
  return (
    <div className={ROOT_CLASS_NAME}>
      <RadioGroup
        aria-label={SCOPE_LABEL}
        variant="secondary"
        value={scope}
        isDisabled={isDisabled}
        onChange={(next) => onScopeChange(next as DeleteScope)}
      >
        <Radio value="entry">
          <Radio.Content>
            <Radio.Control>
              <Radio.Indicator />
            </Radio.Control>
            {ENTRY_OPTION_LABEL}
          </Radio.Content>
          <Description>{ENTRY_OPTION_HINT}</Description>
        </Radio>
        <Radio value="plan">
          <Radio.Content>
            <Radio.Control>
              <Radio.Indicator />
            </Radio.Control>
            {PLAN_OPTION_LABEL}
          </Radio.Content>
          <Description>{planOptionHint(progress.total)}</Description>
        </Radio>
      </RadioGroup>

      {scope === "plan" ? (
        <>
          <InlineAlert variant="error">
            {planWarning(side, progress)}
          </InlineAlert>
          <Checkbox
            className={ACKNOWLEDGE_CLASS_NAME}
            variant="secondary"
            isSelected={acknowledged}
            isDisabled={isDisabled}
            onChange={onAcknowledgedChange}
          >
            <Checkbox.Content>
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              {ACKNOWLEDGE_LABEL}
            </Checkbox.Content>
          </Checkbox>
        </>
      ) : null}
    </div>
  );
}
