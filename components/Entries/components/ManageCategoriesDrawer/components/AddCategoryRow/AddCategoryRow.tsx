import { PlusIcon } from "@heroicons/react/24/outline";
import { FieldError, Input, TextField } from "@heroui/react";
import { useState, useTransition } from "react";
import type { KeyboardEvent } from "react";

import { PendingButton } from "@/components/shared/PendingButton";
import { CATEGORY_NAME_MAX_LENGTH } from "@/core/incomes/consts";

import {
  FIELD_HEIGHT_CLASS_NAME,
  FIELD_VARIANT,
} from "@/components/Entries/styles";
import {
  ADD_LABEL,
  ADD_PENDING_LABEL,
  NAME_ARIA_LABEL,
  NAME_PLACEHOLDER,
} from "./consts";
import { FIELD_CLASS_NAME, ROOT_CLASS_NAME } from "./styles";
import type { AddCategoryRowProps } from "./types";

export function AddCategoryRow({ onCreate, onAdded }: AddCategoryRowProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canAdd = name.trim().length > 0 && !isPending;

  const handleAdd = () => {
    startTransition(async () => {
      const result = await onCreate(name);

      if (result.status === "success") {
        onAdded(result.category);
        setName("");
        setError(null);

        return;
      }

      setError(result.fieldErrors?.name?.[0] ?? result.message);
    });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();

    if (canAdd) {
      handleAdd();
    }
  };

  return (
    <div className={ROOT_CLASS_NAME}>
      <TextField
        aria-label={NAME_ARIA_LABEL}
        className={FIELD_CLASS_NAME}
        isDisabled={isPending}
        isInvalid={error !== null}
        maxLength={CATEGORY_NAME_MAX_LENGTH}
        value={name}
        onChange={(value) => {
          setName(value);
          setError(null);
        }}
      >
        <Input
          variant={FIELD_VARIANT}
          className={FIELD_HEIGHT_CLASS_NAME}
          placeholder={NAME_PLACEHOLDER}
          onKeyDown={handleKeyDown}
        />
        {error ? <FieldError>{error}</FieldError> : null}
      </TextField>
      <PendingButton
        className={FIELD_HEIGHT_CLASS_NAME}
        Icon={PlusIcon}
        isDisabled={!name.trim()}
        isPending={isPending}
        label={ADD_LABEL}
        pendingLabel={ADD_PENDING_LABEL}
        onPress={handleAdd}
      />
    </div>
  );
}
