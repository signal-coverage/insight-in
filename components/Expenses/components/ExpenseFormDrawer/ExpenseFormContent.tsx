import { PlusIcon } from "@heroicons/react/24/outline";
import {
  Button,
  Description,
  Drawer,
  FieldError,
  Form,
  Input,
  Label,
  Select,
  TextArea,
  TextField,
} from "@heroui/react";
import { useState, useTransition } from "react";
import type { FormEvent } from "react";

import {
  AccountField,
  resolveAccountId,
} from "@/components/Entries/components/AccountField";
import { CardField } from "@/components/Entries/components/CardField";
import { CategoryField } from "@/components/Entries/components/CategoryField";
import { DatePickerField } from "@/components/Entries/components/DatePickerField";
import { OriginSection } from "@/components/Entries/components/OriginSection";
import { useServerFieldErrors } from "@/components/Entries/useServerFieldErrors";
import { DEFAULT_ENTRY_STATUS } from "@/core/entries/status";
import { CurrencyListBox } from "@/components/Entries/components/CurrencyListBox";
import {
  AMOUNT_HINT,
  AMOUNT_LABEL,
  AMOUNT_PLACEHOLDER,
  CANCEL_LABEL,
  CURRENCY_LABEL,
  CURRENCY_PLACEHOLDER,
  DATE_LABEL,
  DESCRIPTION_LABEL,
  NOTES_LABEL,
  NOTES_PLACEHOLDER,
  PURCHASE_DATE_LABEL,
} from "@/components/Entries/formConsts";
import {
  AMOUNT_ROW_CLASS_NAME,
  DRAWER_DESCRIPTION_CLASS_NAME,
  FIELD_CLASS_NAME,
  FIELD_HEIGHT_CLASS_NAME,
  FIELD_VARIANT,
  FORM_CLASS_NAME,
  SELECT_TRIGGER_CLASS_NAME,
} from "@/components/Entries/styles";
import { InlineAlert } from "@/components/shared/InlineAlert";
import { PendingButton } from "@/components/shared/PendingButton";
import {
  createCategoryAction,
  createExpenseAction,
  updateExpenseAction,
} from "@/core/expenses/actions";
import type { ExpenseFieldErrors } from "@/core/expenses/types";
import {
  DEFAULT_CURRENCY_CODE,
  DESCRIPTION_MAX_LENGTH,
  NOTES_MAX_LENGTH,
} from "@/core/incomes/consts";

import {
  ORIGIN_SECTION_COPY,
  RECURRING_LOCKED_HINT,
  RECURRING_SWITCH_LABEL,
} from "../../consts";
import { DebitAccountLine } from "./components/DebitAccountLine";
import { ExpectedReimbursementField } from "./components/ExpectedReimbursementField";
import { ExpenseStatusField } from "./components/ExpenseStatusField";
import { RecurringSwitch } from "./components/RecurringSwitch";
import {
  CREATE_DESCRIPTION,
  CREATE_HEADING,
  CREATE_PENDING_LABEL,
  CREATE_SUBMIT_LABEL,
  DESCRIPTION_PLACEHOLDER,
  EDIT_DESCRIPTION,
  EDIT_HEADING,
  EDIT_PENDING_LABEL,
  EDIT_SUBMIT_LABEL,
  FORM_ID,
} from "./consts";
import type { ExpenseFormContentProps } from "./types";
import { chargeLineFor, debitAccountLabel, keepsOwnCard } from "./utils";

// Mounted with a fresh key on every opening, so field defaults and errors always reset.
export function ExpenseFormContent({
  target,
  categories,
  cards,
  accounts,
  onClose,
}: ExpenseFormContentProps) {
  const { expense, defaultDate } = target;
  const isInstallment = expense !== null && expense.installmentPlanId !== null;
  const [isPending, startTransition] = useTransition();
  // The refusals of the server stay until the input that caused them changes: see clearFieldErrors.
  const { fieldErrors, setFieldErrors, clearFieldErrors } =
    useServerFieldErrors<ExpenseFieldErrors>();
  const [formError, setFormError] = useState<string | null>(null);
  // Kept in state because the card choice depends on the currency, and the date field and the
  // charge line depend on the card. An expense with a card shows the day it was bought, not the day
  // the card charges it. The amount is kept too: the origin section works out the implied rate from it.
  const [amount, setAmount] = useState(expense?.amountDecimal ?? "");
  const [currency, setCurrency] = useState(
    expense?.currency ?? DEFAULT_CURRENCY_CODE,
  );
  const [cardId, setCardId] = useState<string | null>(expense?.cardId ?? null);
  // The account the money leaves. A currency change drops it (the field then preselects the only
  // account of the new currency, if there is exactly one); an edit keeps the expense's own account
  // even if it was archived since.
  const keepAccountId = expense?.accountId ?? null;
  const [accountId, setAccountId] = useState<string | null>(keepAccountId);
  const account = resolveAccountId(
    accounts,
    currency,
    accountId,
    keepAccountId,
  );
  const [date, setDate] = useState<string | null>(
    expense?.purchaseDate ?? expense?.date ?? defaultDate,
  );
  // An installment keeps the card of its plan, so the form never offers one for it. A card that is
  // gone, or that cannot pay in the currency of the expense, counts as no card.
  const card = isInstallment
    ? undefined
    : cards.find(
        (option) =>
          option.id === cardId &&
          (option.currencies.includes(currency) ||
            keepsOwnCard(expense, option.id, currency)),
      );

  const hasOriginErrors = Boolean(
    fieldErrors.originCurrency || fieldErrors.originAmount,
  );

  // The card, the account, the currency, the status and the date can all change the server's
  // verdict (funds, the card's account, the date rule), so changing any of them drops the refusals.
  const handleCardChange = (next: string | null) => {
    setCardId(next);
    clearFieldErrors();
  };

  const handleAccountChange = (next: string | null) => {
    setAccountId(next);
    clearFieldErrors();
  };

  const handleDateChange = (next: string | null) => {
    setDate(next);
    clearFieldErrors();
  };

  const handleCurrencyChange = (next: string) => {
    setCurrency(next);
    setAccountId(null);
    clearFieldErrors();

    if (
      card &&
      !card.currencies.includes(next) &&
      !keepsOwnCard(expense, card.id, next)
    ) {
      setCardId(null);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = expense
        ? await updateExpenseAction(expense.id, formData)
        : await createExpenseAction(formData);

      if (result.status === "success") {
        onClose();

        return;
      }

      setFieldErrors(result.fieldErrors ?? {});
      setFormError(result.fieldErrors ? null : result.message);
    });
  };

  return (
    <>
      <Drawer.CloseTrigger />
      <Drawer.Header>
        <Drawer.Heading>
          {expense ? EDIT_HEADING : CREATE_HEADING}
        </Drawer.Heading>
        <p className={DRAWER_DESCRIPTION_CLASS_NAME}>
          {expense ? EDIT_DESCRIPTION : CREATE_DESCRIPTION}
        </p>
      </Drawer.Header>
      <Drawer.Body>
        <Form
          id={FORM_ID}
          className={FORM_CLASS_NAME}
          validationErrors={fieldErrors}
          onSubmit={handleSubmit}
        >
          <TextField
            isRequired
            className={FIELD_CLASS_NAME}
            name="description"
            maxLength={DESCRIPTION_MAX_LENGTH}
            defaultValue={expense?.description}
          >
            <Label>{DESCRIPTION_LABEL}</Label>
            <Input
              variant={FIELD_VARIANT}
              className={FIELD_HEIGHT_CLASS_NAME}
              placeholder={DESCRIPTION_PLACEHOLDER}
            />
            <FieldError />
          </TextField>

          <div className={AMOUNT_ROW_CLASS_NAME}>
            <TextField
              isRequired
              className={FIELD_CLASS_NAME}
              name="amount"
              inputMode="decimal"
              value={amount}
              onChange={setAmount}
            >
              <Label>{AMOUNT_LABEL}</Label>
              <Input
                variant={FIELD_VARIANT}
                className={FIELD_HEIGHT_CLASS_NAME}
                placeholder={AMOUNT_PLACEHOLDER}
              />
              <Description>{AMOUNT_HINT}</Description>
              <FieldError />
            </TextField>

            <Select
              isRequired
              variant={FIELD_VARIANT}
              className={FIELD_CLASS_NAME}
              name={isInstallment ? undefined : "currency"}
              isDisabled={isInstallment}
              placeholder={CURRENCY_PLACEHOLDER}
              value={currency}
              onChange={(value) => {
                if (typeof value === "string") {
                  handleCurrencyChange(value);
                }
              }}
            >
              <Label>{CURRENCY_LABEL}</Label>
              <Select.Trigger className={SELECT_TRIGGER_CLASS_NAME}>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <CurrencyListBox includeCrypto />
              </Select.Popover>
              <FieldError />
            </Select>
            {/* A disabled select sends nothing, so the plan's currency travels in a hidden field. */}
            {isInstallment ? (
              <input type="hidden" name="currency" value={currency} />
            ) : null}
          </div>

          {/* What the user expects to be paid back for it. An installment belongs to its plan, which has
              no such expectation. */}
          {isInstallment ? null : (
            <ExpectedReimbursementField
              defaultValue={expense?.expectedReimbursementDecimal ?? null}
            />
          )}

          {/* The price in another currency, only as a reference. An installment belongs to its plan,
              which does not record one. */}
          {isInstallment ? null : (
            <OriginSection
              copy={ORIGIN_SECTION_COPY}
              netAmount={amount}
              netCurrency={currency}
              defaultCurrency={expense?.originCurrency ?? null}
              defaultAmount={expense?.originAmountDecimal ?? null}
              hasErrors={hasOriginErrors}
            />
          )}

          {/* Only the cards that can pay in the currency of the expense are offered, and an installment
              never offers one. The choice travels in a hidden input: "Sin tarjeta" sends nothing. */}
          {cards.length > 0 && !isInstallment ? (
            <CardField
              cards={cards}
              currency={currency}
              value={card?.id ?? null}
              onChange={handleCardChange}
              errorMessage={fieldErrors.cardId?.[0]}
              keepCardId={
                expense && expense.currency === currency ? expense.cardId : null
              }
            />
          ) : null}
          <input type="hidden" name="cardId" value={card?.id ?? ""} />

          {/* With a credit card the date is the purchase day, and the card works out when it
              charges it. */}
          <DatePickerField
            isRequired
            name="date"
            label={card?.kind === "CREDIT" ? PURCHASE_DATE_LABEL : DATE_LABEL}
            value={date}
            onChange={handleDateChange}
            description={chargeLineFor(card, date) ?? undefined}
          />

          <CategoryField
            categories={categories}
            defaultCategoryId={expense?.categoryId ?? null}
            onCreate={createCategoryAction}
          />

          {/* A debit card decides the account on the server: the form shows it instead of asking. */}
          {card?.kind === "DEBIT" ? (
            <DebitAccountLine
              label={debitAccountLabel(card, currency, expense)}
              errorMessage={fieldErrors.accountId?.[0]}
            />
          ) : (
            <AccountField
              accounts={accounts}
              currency={currency}
              value={account}
              keepAccountId={keepAccountId}
              onChange={handleAccountChange}
              errorMessage={fieldErrors.accountId?.[0]}
            />
          )}

          {/* Any expense can be pending, paid, or covered by someone else. A new one starts paid. */}
          <ExpenseStatusField
            defaultStatus={expense ? expense.status : DEFAULT_ENTRY_STATUS}
            onChange={clearFieldErrors}
          />

          {/* An installment never repeats on its own: its plan already spreads it over the months.
              Any other expense is recurring exactly when it belongs to a template: from then on the
              template is managed in the recurring-expenses wizard, not from here. */}
          {isInstallment ? null : (
            <RecurringSwitch
              defaultRecurring={expense?.isRecurring ?? false}
              label={RECURRING_SWITCH_LABEL}
              lockedHint={
                expense?.isRecurring ? RECURRING_LOCKED_HINT : undefined
              }
            />
          )}

          <TextField
            className={FIELD_CLASS_NAME}
            name="notes"
            maxLength={NOTES_MAX_LENGTH}
            defaultValue={expense?.notes ?? ""}
          >
            <Label>{NOTES_LABEL}</Label>
            <TextArea
              variant={FIELD_VARIANT}
              placeholder={NOTES_PLACEHOLDER}
              rows={3}
            />
            <FieldError />
          </TextField>

          {formError ? (
            <InlineAlert variant="error">{formError}</InlineAlert>
          ) : null}
        </Form>
      </Drawer.Body>
      <Drawer.Footer>
        <Button slot="close" variant="tertiary" isDisabled={isPending}>
          {CANCEL_LABEL}
        </Button>
        <PendingButton
          type="submit"
          form={FORM_ID}
          isPending={isPending}
          Icon={expense ? undefined : PlusIcon}
          label={expense ? EDIT_SUBMIT_LABEL : CREATE_SUBMIT_LABEL}
          pendingLabel={expense ? EDIT_PENDING_LABEL : CREATE_PENDING_LABEL}
        />
      </Drawer.Footer>
    </>
  );
}
