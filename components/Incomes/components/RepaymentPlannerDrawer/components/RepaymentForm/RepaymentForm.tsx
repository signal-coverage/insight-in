import { Input, Label, TextArea, TextField } from "@heroui/react";

import { AmountCurrencyFields } from "@/components/Entries/components/AmountCurrencyFields";
import { AmountModeField } from "@/components/Entries/components/AmountModeField";
import { CategoryField } from "@/components/Entries/components/CategoryField";
import { CuotasCountField } from "@/components/Entries/components/CuotasCountField";
import { DatePickerField } from "@/components/Entries/components/DatePickerField";
import { InstallmentPreview } from "@/components/Entries/components/InstallmentPreview";
import { MediumField } from "@/components/Entries/components/MediumField";
import {
  NOTES_LABEL,
  NOTES_PLACEHOLDER,
} from "@/components/Entries/formConsts";
import {
  AMOUNT_ROW_CLASS_NAME,
  FIELD_CLASS_NAME,
  FIELD_HEIGHT_CLASS_NAME,
  FIELD_VARIANT,
  FORM_CLASS_NAME,
} from "@/components/Entries/styles";
import { createCategoryAction } from "@/core/incomes/actions";
import {
  DESCRIPTION_MAX_LENGTH,
  NOTES_MAX_LENGTH,
} from "@/core/incomes/consts";
import { INSTALLMENT_SUFFIX_LENGTH } from "@/core/installments/consts";

import { CONCEPT_LABEL, CONCEPT_PLACEHOLDER, FIRST_DATE_LABEL } from "./consts";
import type { RepaymentFormProps } from "./types";

// The first step: the data of the repayment. Everything lives in the parent, so going to the ticket
// and coming back finds every field as it was left. Like a purchase but with no card: the money
// arrives in an account or as cash, on the dates the user types.
export function RepaymentForm({
  values,
  categories,
  preview,
  onChange,
}: RepaymentFormProps) {
  return (
    <div className={FORM_CLASS_NAME}>
      <TextField
        isRequired
        className={FIELD_CLASS_NAME}
        maxLength={DESCRIPTION_MAX_LENGTH - INSTALLMENT_SUFFIX_LENGTH}
        value={values.description}
        onChange={(description) => onChange({ description })}
      >
        <Label>{CONCEPT_LABEL}</Label>
        <Input
          variant={FIELD_VARIANT}
          className={FIELD_HEIGHT_CLASS_NAME}
          placeholder={CONCEPT_PLACEHOLDER}
        />
      </TextField>

      <CategoryField
        categories={categories}
        defaultCategoryId={values.categoryId}
        onCreate={createCategoryAction}
        onChange={(categoryId) => onChange({ categoryId })}
      />

      <AmountModeField
        value={values.amountMode}
        onChange={(amountMode) => onChange({ amountMode })}
      />

      <AmountCurrencyFields
        amount={values.amount}
        currency={values.currency}
        onChange={onChange}
      />

      {/* How the money arrives: in an account or as cash. */}
      <MediumField
        defaultMedium={values.medium}
        onChange={(medium) => onChange({ medium })}
      />

      <div className={AMOUNT_ROW_CLASS_NAME}>
        <CuotasCountField
          value={values.totalCuotas}
          onChange={(totalCuotas) => onChange({ totalCuotas })}
        />

        <DatePickerField
          isRequired
          label={FIRST_DATE_LABEL}
          value={values.firstDate}
          onChange={(firstDate) => onChange({ firstDate })}
        />
      </div>

      <TextField
        className={FIELD_CLASS_NAME}
        maxLength={NOTES_MAX_LENGTH}
        value={values.notes}
        onChange={(notes) => onChange({ notes })}
      >
        <Label>{NOTES_LABEL}</Label>
        <TextArea
          variant={FIELD_VARIANT}
          placeholder={NOTES_PLACEHOLDER}
          rows={3}
        />
      </TextField>

      <InstallmentPreview text={preview} />
    </div>
  );
}
