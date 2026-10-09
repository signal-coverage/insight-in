import { PlusIcon } from "@heroicons/react/24/outline";
import {
  Button,
  Drawer,
  FieldError,
  Form,
  Input,
  Label,
  TextField,
} from "@heroui/react";
import { useState, useTransition } from "react";
import type { FormEvent } from "react";

import { CANCEL_LABEL } from "@/components/Entries/formConsts";
import {
  DRAWER_DESCRIPTION_CLASS_NAME,
  FIELD_CLASS_NAME,
  FIELD_HEIGHT_CLASS_NAME,
  FIELD_VARIANT,
  FORM_CLASS_NAME,
} from "@/components/Entries/styles";
import { InlineAlert } from "@/components/shared/InlineAlert";
import { PendingButton } from "@/components/shared/PendingButton";
import {
  archiveBankAction,
  createBankAction,
  deleteBankAction,
  unarchiveBankAction,
  updateBankAction,
} from "@/core/banks/actions";
import { countActiveAccounts } from "@/core/banks/board";
import { BANK_NAME_MAX_LENGTH, DEFAULT_BANK_KIND } from "@/core/banks/consts";
import type { BanksFieldErrors } from "@/core/banks/types";

import { ConfirmDeleteDialog } from "../ConfirmDeleteDialog";

import { KindField } from "./components/KindField";

import {
  ARCHIVE_LABEL,
  ARCHIVE_PENDING_LABEL,
  ARCHIVE_SECTION_LABEL,
  bankArchiveHint,
  CREATE_DESCRIPTION,
  CREATE_HEADING,
  CREATE_PENDING_LABEL,
  CREATE_SUBMIT_LABEL,
  DELETE_HINT,
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
  UNARCHIVE_LABEL,
  UNARCHIVE_PENDING_LABEL,
} from "./consts";
import {
  ARCHIVE_SECTION_CLASS_NAME,
  DELETE_SECTION_CLASS_NAME,
} from "./styles";
import type { BankFormContentProps } from "./types";

// Mounted with a fresh key on every opening, so field defaults and errors always reset.
export function BankFormContent({ target, onClose }: BankFormContentProps) {
  const { bank } = target;
  const [isSaving, startSave] = useTransition();
  const [isArchiving, startArchive] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<BanksFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const activeAccounts = bank ? countActiveAccounts(bank) : 0;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    startSave(async () => {
      const result = bank
        ? await updateBankAction(bank.id, formData)
        : await createBankAction(formData);

      if (result.status === "success") {
        onClose();

        return;
      }

      setFieldErrors(result.fieldErrors ?? {});
      setFormError(result.fieldErrors ? null : result.message);
    });
  };

  // A bank is archived only when all its accounts are: the button is disabled until then, and the
  // server enforces the rule anyway (a refusal is shown as an alert).
  const handleArchiveToggle = () => {
    if (!bank) {
      return;
    }

    startArchive(async () => {
      const result = bank.archived
        ? await unarchiveBankAction(bank.id)
        : await archiveBankAction(bank.id);

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
        <Drawer.Heading>{bank ? EDIT_HEADING : CREATE_HEADING}</Drawer.Heading>
        <p className={DRAWER_DESCRIPTION_CLASS_NAME}>
          {bank ? EDIT_DESCRIPTION : CREATE_DESCRIPTION}
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
            autoFocus
            className={FIELD_CLASS_NAME}
            name={NAME_FIELD_NAME}
            maxLength={BANK_NAME_MAX_LENGTH}
            defaultValue={bank?.name ?? ""}
          >
            <Label>{NAME_LABEL}</Label>
            <Input
              variant={FIELD_VARIANT}
              className={FIELD_HEIGHT_CLASS_NAME}
              placeholder={NAME_PLACEHOLDER}
            />
            <FieldError />
          </TextField>

          <KindField defaultValue={bank?.kind ?? DEFAULT_BANK_KIND} />

          {formError ? (
            <InlineAlert variant="error">{formError}</InlineAlert>
          ) : null}
        </Form>

        {bank ? (
          <section
            className={ARCHIVE_SECTION_CLASS_NAME}
            aria-label={ARCHIVE_SECTION_LABEL}
          >
            <p className={DRAWER_DESCRIPTION_CLASS_NAME}>
              {bankArchiveHint(bank.archived, activeAccounts)}
            </p>
            <PendingButton
              type="button"
              variant="secondary"
              isPending={isArchiving}
              isDisabled={isSaving || (!bank.archived && activeAccounts > 0)}
              label={bank.archived ? UNARCHIVE_LABEL : ARCHIVE_LABEL}
              pendingLabel={
                bank.archived ? UNARCHIVE_PENDING_LABEL : ARCHIVE_PENDING_LABEL
              }
              onPress={handleArchiveToggle}
            />
          </section>
        ) : null}

        {bank ? (
          <section
            className={DELETE_SECTION_CLASS_NAME}
            aria-label={DELETE_SECTION_LABEL}
          >
            <p className={DRAWER_DESCRIPTION_CLASS_NAME}>{DELETE_HINT}</p>
            <Button
              type="button"
              variant="danger-soft"
              isDisabled={isSaving || isArchiving}
              onPress={() => setIsConfirmingDelete(true)}
            >
              {DELETE_LABEL}
            </Button>
            <ConfirmDeleteDialog
              isOpen={isConfirmingDelete}
              onOpenChange={setIsConfirmingDelete}
              onDeleted={onClose}
              heading={deleteHeading(bank.name)}
              warning={DELETE_WARNING}
              onConfirm={() => deleteBankAction(bank.id)}
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
          isDisabled={isArchiving}
          Icon={bank ? undefined : PlusIcon}
          label={bank ? EDIT_SUBMIT_LABEL : CREATE_SUBMIT_LABEL}
          pendingLabel={bank ? EDIT_PENDING_LABEL : CREATE_PENDING_LABEL}
        />
      </Drawer.Footer>
    </>
  );
}
