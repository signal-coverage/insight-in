import { Chip, Radio, RadioGroup } from "@heroui/react";

import {
  CHOICE_CLASS_NAMES,
  CHOICE_OPTIONS,
  DECIDED_CLASS_NAMES,
  DECIDED_LABELS,
  decisionAriaLabel,
} from "./consts";
import type { DecisionCellProps } from "./types";
import { isChoice } from "./utils";

// A template still waiting for a choice gets three radios, none selected at first. A decided one
// has nothing to choose any more and shows what was decided.
export function DecisionCell({
  row,
  choice,
  isDisabled,
  onChange,
}: DecisionCellProps) {
  if (row.decision !== null) {
    return (
      <Chip variant="soft" className={DECIDED_CLASS_NAMES[row.decision]}>
        {DECIDED_LABELS[row.decision]}
      </Chip>
    );
  }

  return (
    <RadioGroup
      aria-label={decisionAriaLabel(row.description)}
      orientation="horizontal"
      variant="secondary"
      isDisabled={isDisabled}
      value={choice ?? ""}
      onChange={(value) => {
        if (isChoice(value)) {
          onChange(value);
        }
      }}
    >
      {CHOICE_OPTIONS.map(({ value, label }) => (
        <Radio key={value} value={value} className={CHOICE_CLASS_NAMES[value]}>
          <Radio.Content>
            <Radio.Control>
              <Radio.Indicator />
            </Radio.Control>
            {label}
          </Radio.Content>
        </Radio>
      ))}
    </RadioGroup>
  );
}
