import { Input, Label, TextArea, TextField } from "@heroui/react";

import { AmountCurrencyFields } from "@/components/Entries/components/AmountCurrencyFields";
import { AmountModeField } from "@/components/Entries/components/AmountModeField";
import { CategoryField } from "@/components/Entries/components/CategoryField";
import { CuotasCountField } from "@/components/Entries/components/CuotasCountField";
import { DatePickerField } from "@/components/Entries/components/DatePickerField";
import { InstallmentPreview } from "@/components/Entries/components/InstallmentPreview";
import {
  NOTES_LABEL,
  NOTES_PLACEHOLDER,
  PURCHASE_DATE_LABEL,
} from "@/components/Entries/formConsts";
import {
  AMOUNT_ROW_CLASS_NAME,
  FIELD_CLASS_NAME,
  FIELD_HEIGHT_CLASS_NAME,
  FIELD_VARIANT,
  FORM_CLASS_NAME,
} from "@/components/Entries/styles";
import { createCategoryAction } from "@/core/expenses/actions";
import {
  DESCRIPTION_MAX_LENGTH,
  NOTES_MAX_LENGTH,
} from "@/core/incomes/consts";
import { INSTALLMENT_SUFFIX_LENGTH } from "@/core/installments/consts";

import { CardOwnershipFields } from "./components/CardOwnershipFields";
import { FIRST_DATE_LABEL, PRODUCT_LABEL, PRODUCT_PLACEHOLDER } from "./consts";
import type { PurchaseFormProps } from "./types";

// The first step: the data of the purchase. Everything lives in the parent, so going to the ticket
// and coming back finds every field as it was left.
export function PurchaseForm({
  values,
  categories,
  cards,
  preview,
  recommendations,
  firstInstallment,
  onChange,
}: PurchaseFormProps) {
  const isOwn = values.cardOwnership === "own";

  return (
    <div className={FORM_CLASS_NAME}>
      <TextField
        isRequired
        className={FIELD_CLASS_NAME}
        maxLength={DESCRIPTION_MAX_LENGTH - INSTALLMENT_SUFFIX_LENGTH}
        value={values.description}
        onChange={(description) => onChange({ description })}
      >
        <Label>{PRODUCT_LABEL}</Label>
        <Input
          variant={FIELD_VARIANT}
          className={FIELD_HEIGHT_CLASS_NAME}
          placeholder={PRODUCT_PLACEHOLDER}
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

      {/* A purchase in installments is always on a card: one of the user's own (digital money, with
          the cards of the purchase's currency to pick from) or a borrowed one (with its medium). */}
      <CardOwnershipFields
        values={values}
        cards={cards}
        recommendations={recommendations}
        onChange={onChange}
      />

      <div className={AMOUNT_ROW_CLASS_NAME}>
        <CuotasCountField
          value={values.totalCuotas}
          onChange={(totalCuotas) => onChange({ totalCuotas })}
        />

        {/* With an own card the user gives the day of the purchase and the card's cycle works out
            the first installment; with a borrowed one the first installment's date is typed. */}
        <DatePickerField
          isRequired
          label={isOwn ? PURCHASE_DATE_LABEL : FIRST_DATE_LABEL}
          value={isOwn ? values.purchaseDate : values.firstDate}
          onChange={(date) =>
            onChange(isOwn ? { purchaseDate: date } : { firstDate: date })
          }
          description={firstInstallment ?? undefined}
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
