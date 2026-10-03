import { Description, Label, NumberField } from "@heroui/react";

import { FIELD_VARIANT } from "@/components/Entries/styles";
import { MAX_INSTALLMENTS, MIN_INSTALLMENTS } from "@/core/installments/consts";

import { COUNT_DESCRIPTION, COUNT_LABEL } from "./consts";
import {
  COUNT_FIELD_CLASS_NAME,
  COUNT_GROUP_CLASS_NAME,
  COUNT_INPUT_CLASS_NAME,
} from "./styles";
import type { CuotasCountFieldProps } from "./types";

// How many installments a plan has: a stepper from the fewest to the most the app allows.
export function CuotasCountField({ value, onChange }: CuotasCountFieldProps) {
  return (
    <NumberField
      isRequired
      className={COUNT_FIELD_CLASS_NAME}
      variant={FIELD_VARIANT}
      minValue={MIN_INSTALLMENTS}
      maxValue={MAX_INSTALLMENTS}
      value={value ?? Number.NaN}
      onChange={(next) =>
        onChange(next === undefined || Number.isNaN(next) ? null : next)
      }
    >
      <Label>{COUNT_LABEL}</Label>
      <NumberField.Group className={COUNT_GROUP_CLASS_NAME}>
        <NumberField.DecrementButton />
        <NumberField.Input className={COUNT_INPUT_CLASS_NAME} />
        <NumberField.IncrementButton />
      </NumberField.Group>
      <Description>{COUNT_DESCRIPTION}</Description>
    </NumberField>
  );
}
