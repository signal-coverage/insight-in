import { Label, ListBox, Select } from "@heroui/react";

import {
  FIELD_VARIANT,
  SELECT_TRIGGER_CLASS_NAME,
} from "@/components/Entries/styles";
import { ALL_KEY } from "../../consts";
import type { FilterSelectProps } from "../../types";

// A Select whose first item ("All ...") means "no filter".
export function FilterSelect({
  label,
  allLabel,
  options,
  value,
  className,
  onChange,
}: FilterSelectProps) {
  return (
    <Select
      variant={FIELD_VARIANT}
      className={className}
      value={value ?? ALL_KEY}
      onChange={(next) =>
        onChange(typeof next === "string" && next !== ALL_KEY ? next : null)
      }
    >
      <Label>{label}</Label>
      <Select.Trigger className={SELECT_TRIGGER_CLASS_NAME}>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          <ListBox.Item id={ALL_KEY} textValue={allLabel}>
            {allLabel}
            <ListBox.ItemIndicator />
          </ListBox.Item>
          {options.map((option) => (
            <ListBox.Item
              key={option.id}
              id={option.id}
              textValue={option.label}
            >
              {option.label}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
