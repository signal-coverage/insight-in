import { Chip, Radio, RadioGroup } from "@heroui/react";

import {
  CHOICE_OPTIONS,
  DECIDED_COLORS,
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
      <Chip color={DECIDED_COLORS[row.decision]} variant="soft">
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
        <Radio key={value} value={value}>
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
