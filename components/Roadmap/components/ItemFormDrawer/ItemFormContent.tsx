import { PlusIcon } from "@heroicons/react/24/outline";
import {
  Button,
  Drawer,
  FieldError,
  Form,
  Input,
  Label,
  TextArea,
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
import { createItemAction, updateItemAction } from "@/core/roadmap/actions";
import {
  DESCRIPTION_MAX_LENGTH,
  TITLE_MAX_LENGTH,
} from "@/core/roadmap/consts";
import type { RoadmapFieldErrors } from "@/core/roadmap/types";

import {
  CREATE_HEADING,
  CREATE_PENDING_LABEL,
  CREATE_SUBMIT_LABEL,
  DESCRIPTION_FIELD_NAME,
  DESCRIPTION_LABEL,
  DESCRIPTION_PLACEHOLDER,
  EDIT_DESCRIPTION,
  EDIT_HEADING,
  EDIT_PENDING_LABEL,
  EDIT_SUBMIT_LABEL,
  FORM_ID,
  STATUS_FIELD_NAME,
  TITLE_FIELD_NAME,
  TITLE_LABEL,
  TITLE_PLACEHOLDER,
  createDescription,
} from "./consts";
import type { ItemFormContentProps } from "./types";

// Mounted with a fresh key on every opening, so field defaults and errors always reset.
export function ItemFormContent({ target, onClose }: ItemFormContentProps) {
  const { item, status } = target;
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<RoadmapFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = item
        ? await updateItemAction(item.id, formData)
        : await createItemAction(formData);

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
        <Drawer.Heading>{item ? EDIT_HEADING : CREATE_HEADING}</Drawer.Heading>
        <p className={DRAWER_DESCRIPTION_CLASS_NAME}>
          {item ? EDIT_DESCRIPTION : createDescription(status)}
        </p>
      </Drawer.Header>
      <Drawer.Body>
        <Form
          id={FORM_ID}
          className={FORM_CLASS_NAME}
          validationErrors={fieldErrors}
          onSubmit={handleSubmit}
        >
          {/* A new card says which column it goes to; an edit never moves the card. */}
          {item ? null : (
            <input type="hidden" name={STATUS_FIELD_NAME} value={status} />
          )}

          <TextField
            isRequired
            autoFocus
            className={FIELD_CLASS_NAME}
            name={TITLE_FIELD_NAME}
            maxLength={TITLE_MAX_LENGTH}
            defaultValue={item?.title ?? ""}
          >
            <Label>{TITLE_LABEL}</Label>
            <Input
              variant={FIELD_VARIANT}
              className={FIELD_HEIGHT_CLASS_NAME}
              placeholder={TITLE_PLACEHOLDER}
            />
            <FieldError />
          </TextField>

          <TextField
            className={FIELD_CLASS_NAME}
            name={DESCRIPTION_FIELD_NAME}
            maxLength={DESCRIPTION_MAX_LENGTH}
            defaultValue={item?.description ?? ""}
          >
            <Label>{DESCRIPTION_LABEL}</Label>
            <TextArea
              variant={FIELD_VARIANT}
              placeholder={DESCRIPTION_PLACEHOLDER}
              rows={5}
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
          Icon={item ? undefined : PlusIcon}
          label={item ? EDIT_SUBMIT_LABEL : CREATE_SUBMIT_LABEL}
          pendingLabel={item ? EDIT_PENDING_LABEL : CREATE_PENDING_LABEL}
        />
      </Drawer.Footer>
    </>
  );
}
