import { PlusIcon } from "@heroicons/react/24/outline";
import {
  Button,
  Description,
  Drawer,
  FieldError,
  Form,
  Input,
  Label,
  ListBox,
  Select,
  TextField,
} from "@heroui/react";
import { useState, useTransition } from "react";
import type { FormEvent } from "react";

import { CurrencyListBox } from "@/components/Entries/components/CurrencyListBox";
import {
  CANCEL_LABEL,
  CURRENCY_LABEL,
  CURRENCY_PLACEHOLDER,
} from "@/components/Entries/formConsts";
import {
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
  archiveAccountAction,
  createAccountAction,
  deleteAccountAction,
  unarchiveAccountAction,
  updateAccountAction,
} from "@/core/accounts/actions";
import { ACCOUNT_NAME_MAX_LENGTH } from "@/core/accounts/consts";
import type { BanksFieldErrors } from "@/core/banks/types";
import { DEFAULT_CURRENCY_CODE } from "@/core/incomes/consts";

import { ConfirmDeleteDialog } from "../ConfirmDeleteDialog";

import {
  accountArchiveHint,
  accountDeleteHint,
  ARCHIVE_LABEL,
  ARCHIVE_PENDING_LABEL,
  ARCHIVE_SECTION_LABEL,
  BANK_FIELD_NAME,
  BANK_LABEL,
  BANK_PLACEHOLDER,
  CREATE_DESCRIPTION,
  CREATE_HEADING,
  CREATE_PENDING_LABEL,
  CREATE_SUBMIT_LABEL,
  CURRENCY_FIELD_NAME,
  CURRENCY_LOCKED_HINT,
  DELETE_LABEL,
  DELETE_SECTION_LABEL,
  DELETE_WARNING,
  deleteHeading,
  EDIT_DESCRIPTION,
  EDIT_HEADING,
  EDIT_PENDING_LABEL,
  EDIT_SUBMIT_LABEL,
  FORM_ID,
  NAME_FIELD_NAME,
  NAME_LABEL,
  NAME_PLACEHOLDER,
  NO_BANKS_HINT,
  UNARCHIVE_LABEL,
  UNARCHIVE_PENDING_LABEL,
} from "./consts";
import {
  ARCHIVE_SECTION_CLASS_NAME,
  DELETE_SECTION_CLASS_NAME,
} from "./styles";
import type { AccountFormContentProps } from "./types";
import {
  currencyForKind,
  kindOfBank,
  offersCrypto,
  pickDefaultBankId,
} from "./utils";

// Mounted with a fresh key on every opening, so field defaults and errors always reset.
export function AccountFormContent({
  target,
  banks,
  onClose,
}: AccountFormContentProps) {
  const { account, bankId } = target;
  const [isSaving, startSave] = useTransition();
  const [isArchiving, startArchive] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<BanksFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  // A new account needs a bank to go to; an edit never moves it.
  const hasNoBanks = !account && banks.length === 0;
  // An account with movements keeps its currency: the select shows it but cannot change it, and the
  // value travels in a hidden input (a disabled field is not submitted).
  const isCurrencyLocked = account?.hasMovements ?? false;
  // The bank and the currency are controlled: the bank's kind decides whether the crypto currencies
  // are on offer, and a crypto currency goes back to pesos when the bank becomes an entity.
  const [selectedBankId, setSelectedBankId] = useState<string | null>(
    pickDefaultBankId(bankId, banks) ?? null,
  );
  const [currency, setCurrency] = useState(
    account?.currency ?? DEFAULT_CURRENCY_CODE,
  );
  const bankKind = kindOfBank(account ? account.bankId : selectedBankId, banks);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    startSave(async () => {
      const result = account
        ? await updateAccountAction(account.id, formData)
        : await createAccountAction(formData);

      if (result.status === "success") {
        onClose();

        return;
      }

      setFieldErrors(result.fieldErrors ?? {});
      setFormError(result.fieldErrors ? null : result.message);
    });
  };

  // The server refuses to bring an account back under an archived bank (its message is shown as an
  // alert).
  const handleArchiveToggle = () => {
    if (!account) {
      return;
    }

    startArchive(async () => {
      const result = account.archived
        ? await unarchiveAccountAction(account.id)
        : await archiveAccountAction(account.id);

      if (result.status === "success") {
        onClose();

        return;
      }

      // Only the message is shown: a field error from an earlier save no longer applies.
      setFieldErrors({});
      setFormError(result.message);
    });
  };

  return (
    <>
      <Drawer.CloseTrigger />
      <Drawer.Header>
        <Drawer.Heading>
          {account ? EDIT_HEADING : CREATE_HEADING}
        </Drawer.Heading>
        <p className={DRAWER_DESCRIPTION_CLASS_NAME}>
          {account ? EDIT_DESCRIPTION : CREATE_DESCRIPTION}
        </p>
      </Drawer.Header>
      <Drawer.Body>
        <Form
          id={FORM_ID}
          className={FORM_CLASS_NAME}
          validationErrors={fieldErrors}
          onSubmit={handleSubmit}
        >
          {hasNoBanks ? (
            <p className={DRAWER_DESCRIPTION_CLASS_NAME}>{NO_BANKS_HINT}</p>
          ) : null}

          {account || hasNoBanks ? null : (
            <Select
              isRequired
              variant={FIELD_VARIANT}
              className={FIELD_CLASS_NAME}
              name={BANK_FIELD_NAME}
              placeholder={BANK_PLACEHOLDER}
              value={selectedBankId}
              onChange={(value) => {
                if (typeof value === "string") {
                  setSelectedBankId(value);
                  setCurrency((current) =>
                    currencyForKind(current, kindOfBank(value, banks)),
                  );
                }
              }}
            >
              <Label>{BANK_LABEL}</Label>
              <Select.Trigger className={SELECT_TRIGGER_CLASS_NAME}>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {banks.map((bank) => (
                    <ListBox.Item
                      key={bank.id}
                      id={bank.id}
                      textValue={bank.name}
                    >
                      {bank.name}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
              <FieldError />
            </Select>
          )}

          <TextField
            isRequired
            autoFocus
            className={FIELD_CLASS_NAME}
            name={NAME_FIELD_NAME}
            maxLength={ACCOUNT_NAME_MAX_LENGTH}
            defaultValue={account?.name ?? ""}
          >
            <Label>{NAME_LABEL}</Label>
            <Input
              variant={FIELD_VARIANT}
              className={FIELD_HEIGHT_CLASS_NAME}
              placeholder={NAME_PLACEHOLDER}
            />
            <FieldError />
          </TextField>

          <Select
            isRequired
            variant={FIELD_VARIANT}
            className={FIELD_CLASS_NAME}
            name={isCurrencyLocked ? undefined : CURRENCY_FIELD_NAME}
            isDisabled={isCurrencyLocked}
            placeholder={CURRENCY_PLACEHOLDER}
            value={currency}
            onChange={(value) => {
              if (typeof value === "string") {
                setCurrency(value);
              }
            }}
          >
            <Label>{CURRENCY_LABEL}</Label>
            <Select.Trigger className={SELECT_TRIGGER_CLASS_NAME}>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <CurrencyListBox
                includeCrypto={offersCrypto(bankKind, currency)}
                cryptoFirst
              />
            </Select.Popover>
            {isCurrencyLocked ? (
              <Description>{CURRENCY_LOCKED_HINT}</Description>
            ) : null}
            <FieldError />
          </Select>
          {isCurrencyLocked && account ? (
            <input
              type="hidden"
              name={CURRENCY_FIELD_NAME}
              value={account.currency}
            />
          ) : null}

          {formError ? (
            <InlineAlert variant="error">{formError}</InlineAlert>
          ) : null}
        </Form>

        {account ? (
          <section
            className={ARCHIVE_SECTION_CLASS_NAME}
            aria-label={ARCHIVE_SECTION_LABEL}
          >
            <p className={DRAWER_DESCRIPTION_CLASS_NAME}>
              {accountArchiveHint(account.archived)}
            </p>
            <PendingButton
              type="button"
              variant="secondary"
              isPending={isArchiving}
              isDisabled={isSaving}
              label={account.archived ? UNARCHIVE_LABEL : ARCHIVE_LABEL}
              pendingLabel={
                account.archived
                  ? UNARCHIVE_PENDING_LABEL
                  : ARCHIVE_PENDING_LABEL
              }
              onPress={handleArchiveToggle}
            />
          </section>
        ) : null}

        {account ? (
          <section
            className={DELETE_SECTION_CLASS_NAME}
            aria-label={DELETE_SECTION_LABEL}
          >
            <p className={DRAWER_DESCRIPTION_CLASS_NAME}>
              {accountDeleteHint(account.hasMovements)}
            </p>
            <Button
              type="button"
              variant="danger-soft"
              isDisabled={isSaving || isArchiving || account.hasMovements}
              onPress={() => setIsConfirmingDelete(true)}
            >
              {DELETE_LABEL}
            </Button>
            <ConfirmDeleteDialog
              isOpen={isConfirmingDelete}
              onOpenChange={setIsConfirmingDelete}
              onDeleted={onClose}
              heading={deleteHeading(account.name)}
              warning={DELETE_WARNING}
              onConfirm={() => deleteAccountAction(account.id)}
            />
          </section>
        ) : null}
      </Drawer.Body>
      <Drawer.Footer>
        <Button
          slot="close"
          variant="tertiary"
          isDisabled={isSaving || isArchiving}
        >
          {CANCEL_LABEL}
        </Button>
        <PendingButton
          type="submit"
          form={FORM_ID}
          isPending={isSaving}
          isDisabled={isArchiving || hasNoBanks}
          Icon={account ? undefined : PlusIcon}
          label={account ? EDIT_SUBMIT_LABEL : CREATE_SUBMIT_LABEL}
          pendingLabel={account ? EDIT_PENDING_LABEL : CREATE_PENDING_LABEL}
        />
      </Drawer.Footer>
    </>
  );
}
