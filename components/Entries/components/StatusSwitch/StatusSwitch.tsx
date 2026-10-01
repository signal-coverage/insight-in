import { Switch } from "@heroui/react";
import { useState } from "react";

import type { StatusSwitchProps } from "./types";

// The form's status control. An unchecked switch submits nothing, and a missing status would be
// read as "settled", so the value travels in a hidden input that is always present.
export function StatusSwitch({ defaultSettled, label }: StatusSwitchProps) {
  const [isSettled, setIsSettled] = useState(defaultSettled);

  return (
    <>
      <input
        type="hidden"
        name="status"
        value={isSettled ? "SETTLED" : "PLANNED"}
      />
      <Switch isSelected={isSettled} onChange={setIsSettled}>
        <Switch.Content>
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
          {label}
        </Switch.Content>
      </Switch>
    </>
  );
}
