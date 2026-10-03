import { PencilSquareIcon, TrashIcon } from "@heroicons/react/24/outline";
import { TruncatedText } from "@/components/Entries/components/TruncatedText";
import { InlineAlert } from "@/components/shared/InlineAlert";
import { PendingButton } from "@/components/shared/PendingButton";
import { Button, FieldError, Input, TextField } from "@heroui/react";
import { useState, useTransition } from "react";
import type { KeyboardEvent } from "react";

import { CATEGORY_NAME_MAX_LENGTH } from "@/core/incomes/consts";

import {
  FIELD_HEIGHT_CLASS_NAME,
  FIELD_VARIANT,
} from "@/components/Entries/styles";
import { deleteLabel } from "@/components/Entries/consts";
import {
  CANCEL_LABEL,
  NAME_INPUT_ARIA_LABEL,
  SAVE_LABEL,
  SAVE_PENDING_LABEL,
  renameLabel,
} from "./consts";
import {
  ACTION_ICON_CLASS_NAME,
  ACTIONS_CLASS_NAME,
  COUNT_CLASS_NAME,
  EDIT_FIELD_CLASS_NAME,
  EDIT_ROW_CLASS_NAME,
  NAME_CLASS_NAME,
  ROOT_CLASS_NAME,
  SUMMARY_CLASS_NAME,
  VIEW_ROW_CLASS_NAME,
} from "./styles";
import type { CategoryRowProps } from "./types";

export function CategoryRow({
  category,
  countLabel,
  error,
  onRename,
  onDelete,
}: CategoryRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(category.name);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const startEditing = () => {
    setDraft(category.name);
    setRenameError(null);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setRenameError(null);
  };

  const save = () => {
    // Nothing to save: leave edit mode without a round trip.
    if (draft.trim() === category.name) {
      cancelEditing();

      return;
    }

    startTransition(async () => {
      const result = await onRename(category.id, draft);

      if (result.status === "success") {
        cancelEditing();

        return;
      }

      setRenameError(result.fieldErrors?.name?.[0] ?? result.message);
    });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      // The row lives inside a drawer: keep Enter from submitting anything around it.
      event.preventDefault();

      if (!isPending) {
        save();
      }
    } else if (event.key === "Escape") {
      // Escape must only cancel this edit, not close the whole drawer.
      event.preventDefault();
      event.stopPropagation();
      cancelEditing();
    }
  };

  return (
    <li className={ROOT_CLASS_NAME}>
      {isEditing ? (
        <div className={EDIT_ROW_CLASS_NAME}>
          <TextField
            autoFocus
            aria-label={NAME_INPUT_ARIA_LABEL}
            className={EDIT_FIELD_CLASS_NAME}
            isDisabled={isPending}
            isInvalid={renameError !== null}
            maxLength={CATEGORY_NAME_MAX_LENGTH}
            value={draft}
            onChange={(value) => {
              setDraft(value);
              setRenameError(null);
            }}
          >
            <Input
              variant={FIELD_VARIANT}
              className={FIELD_HEIGHT_CLASS_NAME}
              onKeyDown={handleKeyDown}
            />
            {renameError ? <FieldError>{renameError}</FieldError> : null}
          </TextField>
          <PendingButton
            className={FIELD_HEIGHT_CLASS_NAME}
            isDisabled={!draft.trim()}
            isPending={isPending}
            label={SAVE_LABEL}
            pendingLabel={SAVE_PENDING_LABEL}
            onPress={save}
          />
          <Button
            className={FIELD_HEIGHT_CLASS_NAME}
            variant="tertiary"
            isDisabled={isPending}
            onPress={cancelEditing}
          >
            {CANCEL_LABEL}
          </Button>
        </div>
      ) : (
        <div className={VIEW_ROW_CLASS_NAME}>
          <div className={SUMMARY_CLASS_NAME}>
            <TruncatedText className={NAME_CLASS_NAME} testId="category-name">
              {category.name}
            </TruncatedText>
            <span className={COUNT_CLASS_NAME}>{countLabel}</span>
          </div>
          <div className={ACTIONS_CLASS_NAME}>
            <Button
              isIconOnly
              size="sm"
              variant="secondary"
              aria-label={renameLabel(category.name)}
              onPress={startEditing}
            >
              <PencilSquareIcon
                className={ACTION_ICON_CLASS_NAME}
                aria-hidden="true"
              />
            </Button>
            <Button
              isIconOnly
              size="sm"
              variant="danger-soft"
              aria-label={deleteLabel(category.name)}
              onPress={() => onDelete(category)}
            >
              <TrashIcon
                className={ACTION_ICON_CLASS_NAME}
                aria-hidden="true"
              />
            </Button>
          </div>
        </div>
      )}
      {error ? <InlineAlert variant="error">{error}</InlineAlert> : null}
    </li>
  );
}
