import { Description, Switch } from "@heroui/react";
import { useState } from "react";

import type { RecurringSwitchProps } from "./types";

// Marks an expense as one that repeats every month. An unchecked switch submits nothing, so the
// value travels in a hidden input that is always present ("true" / "false").
// With a `lockedHint` the expense already belongs to a recurring template: the switch stays on
// and cannot be changed, and the hint says where to stop the repetition.
export function RecurringSwitch({
  defaultRecurring,
  label,
  lockedHint,
}: RecurringSwitchProps) {
  const [isRecurring, setIsRecurring] = useState(defaultRecurring);
  const isLocked = lockedHint !== undefined;

  return (
    <>
      <input
        type="hidden"
        name="isRecurring"
        value={isRecurring ? "true" : "false"}
      />
      <Switch
        isSelected={isRecurring}
        isDisabled={isLocked}
        onChange={(isSelected) => {
          // A locked switch is disabled, but the value must not move even if an event gets through.
          if (!isLocked) {
            setIsRecurring(isSelected);
          }
        }}
      >
        <Switch.Content>
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
          {label}
        </Switch.Content>
        {isLocked ? <Description>{lockedHint}</Description> : null}
      </Switch>
    </>
  );
}
