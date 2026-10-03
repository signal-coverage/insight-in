import {
  Calendar,
  DateField,
  DatePicker,
  Description,
  FieldError,
  Label,
} from "@heroui/react";
import { useMemo, useState } from "react";

import {
  FIELD_CLASS_NAME,
  FIELD_HEIGHT_CLASS_NAME,
  FIELD_VARIANT,
} from "@/components/Entries/styles";
import { CALENDAR_ARIA_LABEL } from "./consts";
import type { DatePickerFieldProps } from "./types";
import { fromDateValue, toDateValue } from "./utils";

// HeroUI's DatePicker (typed segments + calendar popover) behind the ISO-string interface the
// rest of the app uses, with the same 40px height and "secondary" variant as every other field.
export function DatePickerField({
  label,
  name,
  defaultValue,
  value,
  onChange,
  isRequired,
  description,
  className = FIELD_CLASS_NAME,
}: DatePickerFieldProps) {
  const [uncontrolled, setUncontrolled] = useState<string | null>(
    defaultValue ?? null,
  );
  const isControlled = value !== undefined;
  const current = isControlled ? value : uncontrolled;
  // Stable identity per ISO string, so the picker does not see a "new" date on every render.
  const dateValue = useMemo(() => toDateValue(current), [current]);

  const commit = (next: string | null) => {
    if (!isControlled) {
      setUncontrolled(next);
    }

    onChange?.(next);
  };

  return (
    <DatePicker
      className={className}
      name={name}
      isRequired={isRequired}
      value={dateValue}
      onChange={(next) => commit(fromDateValue(next))}
    >
      <Label>{label}</Label>
      <DateField.Group
        fullWidth
        variant={FIELD_VARIANT}
        className={FIELD_HEIGHT_CLASS_NAME}
      >
        <DateField.Input>
          {(segment) => <DateField.Segment segment={segment} />}
        </DateField.Input>
        <DateField.Suffix>
          <DatePicker.Trigger>
            <DatePicker.TriggerIndicator />
          </DatePicker.Trigger>
        </DateField.Suffix>
      </DateField.Group>
      {description ? <Description>{description}</Description> : null}
      <FieldError />
      <DatePicker.Popover>
        <Calendar aria-label={CALENDAR_ARIA_LABEL}>
          <Calendar.Header>
            <Calendar.YearPickerTrigger>
              <Calendar.YearPickerTriggerHeading />
              <Calendar.YearPickerTriggerIndicator />
            </Calendar.YearPickerTrigger>
            <Calendar.NavButton slot="previous" />
            <Calendar.NavButton slot="next" />
          </Calendar.Header>
          <Calendar.Grid>
            <Calendar.GridHeader>
              {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
            </Calendar.GridHeader>
            <Calendar.GridBody>
              {(date) => <Calendar.Cell date={date} />}
            </Calendar.GridBody>
          </Calendar.Grid>
          <Calendar.YearPickerGrid>
            <Calendar.YearPickerGridBody>
              {({ year }) => <Calendar.YearPickerCell year={year} />}
            </Calendar.YearPickerGridBody>
          </Calendar.YearPickerGrid>
        </Calendar>
      </DatePicker.Popover>
    </DatePicker>
  );
}
