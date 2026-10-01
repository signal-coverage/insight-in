import { PlusIcon } from "@heroicons/react/24/outline";
import {
  Button,
  FieldError,
  Input,
  Label,
  ListBox,
  Select,
  Separator,
  TextField,
} from "@heroui/react";
import { useRef, useState, useTransition } from "react";
import type { KeyboardEvent } from "react";

import { PendingButton } from "@/components/shared/PendingButton";
import { CATEGORY_NAME_MAX_LENGTH } from "@/core/incomes/consts";
import type { EntryCategory } from "@/components/Entries/types";

import {
  FIELD_CLASS_NAME,
  FIELD_HEIGHT_CLASS_NAME,
  FIELD_VARIANT,
  SELECT_TRIGGER_CLASS_NAME,
} from "@/components/Entries/styles";

import {
  ADD_CATEGORY_KEY,
  ADD_CATEGORY_LABEL,
  CANCEL_ADD_LABEL,
  CATEGORY_LABEL,
  CATEGORY_PLACEHOLDER,
  CONFIRM_ADD_LABEL,
  CONFIRM_ADD_PENDING_LABEL,
  NEW_CATEGORY_ARIA_LABEL,
  NEW_CATEGORY_PLACEHOLDER,
} from "./consts";
import {
  ADD_ICON_CLASS_NAME,
  ADD_INPUT_FIELD_CLASS_NAME,
  ADD_ITEM_CLASS_NAME,
  ADD_ROW_CLASS_NAME,
} from "./styles";
import type { CategoryFieldProps } from "./types";
import { mergeCategories } from "./utils";

export function CategoryField({
  categories,
  defaultCategoryId,
  onCreate,
}: CategoryFieldProps) {
  const [created, setCreated] = useState<EntryCategory[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(
    defaultCategoryId,
  );
  const [isAdding, setIsAdding] = useState(false);
  // Bumped to remount the Select: choosing the action item still counts as a selection
  // change for its validation, which would flash a "required" error for an empty field.
  const [selectVersion, setSelectVersion] = useState(0);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  // Identifies the latest add-row session. A creation only applies its outcome to the UI
  // while it is still the latest; picking a category or closing the row supersedes it.
  const activeRequestRef = useRef(0);

  const options = mergeCategories(categories, created);

  const closeAddRow = () => {
    activeRequestRef.current += 1;
    setIsAdding(false);
    setName("");
    setNameError(null);
  };

  // "Add category" is an action item: picking it leaves the current value untouched and
  // opens the add row. Picking a real category ends any add in progress.
  const handleChange = (value: unknown) => {
    if (value === ADD_CATEGORY_KEY) {
      setIsAdding(true);
      setSelectVersion((version) => version + 1);

      return;
    }

    setSelectedId(typeof value === "string" ? value : null);
    closeAddRow();
  };

  const handleAdd = () => {
    const requestId = ++activeRequestRef.current;

    startTransition(async () => {
      const result = await onCreate(name);

      if (result.status === "success") {
        // The category exists on the server either way, so it always joins the list.
        setCreated((current) => [...current, result.category]);

        // Auto-select only if the user has not moved on (picked another category or
        // cancelled) while the request was in flight.
        if (requestId === activeRequestRef.current) {
          setSelectedId(result.category.id);
          closeAddRow();
        }

        return;
      }

      if (requestId === activeRequestRef.current) {
        setNameError(result.fieldErrors?.name?.[0] ?? result.message);
      }
    });
  };

  // The add row sits inside the income form, so Enter must not submit that form.
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();

    if (name.trim() && !isPending) {
      handleAdd();
    }
  };

  return (
    <>
      <Select
        key={selectVersion}
        isRequired
        variant={FIELD_VARIANT}
        className={FIELD_CLASS_NAME}
        name="categoryId"
        placeholder={CATEGORY_PLACEHOLDER}
        value={selectedId}
        onChange={handleChange}
      >
        <Label>{CATEGORY_LABEL}</Label>
        <Select.Trigger className={SELECT_TRIGGER_CLASS_NAME}>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {options.map((category) => (
              <ListBox.Item
                key={category.id}
                id={category.id}
                textValue={category.name}
              >
                {category.name}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
            <Separator />
            <ListBox.Item
              id={ADD_CATEGORY_KEY}
              textValue={ADD_CATEGORY_LABEL}
              className={ADD_ITEM_CLASS_NAME}
            >
              <PlusIcon className={ADD_ICON_CLASS_NAME} aria-hidden="true" />
              {ADD_CATEGORY_LABEL}
            </ListBox.Item>
          </ListBox>
        </Select.Popover>
        <FieldError />
      </Select>

      {isAdding ? (
        <div className={ADD_ROW_CLASS_NAME}>
          <TextField
            autoFocus
            aria-label={NEW_CATEGORY_ARIA_LABEL}
            className={ADD_INPUT_FIELD_CLASS_NAME}
            isDisabled={isPending}
            isInvalid={nameError !== null}
            maxLength={CATEGORY_NAME_MAX_LENGTH}
            value={name}
            onChange={(value) => {
              setName(value);
              setNameError(null);
            }}
          >
            <Input
              variant={FIELD_VARIANT}
              className={FIELD_HEIGHT_CLASS_NAME}
              placeholder={NEW_CATEGORY_PLACEHOLDER}
              onKeyDown={handleKeyDown}
            />
            {nameError ? <FieldError>{nameError}</FieldError> : null}
          </TextField>
          <PendingButton
            className={FIELD_HEIGHT_CLASS_NAME}
            isDisabled={!name.trim()}
            isPending={isPending}
            label={CONFIRM_ADD_LABEL}
            pendingLabel={CONFIRM_ADD_PENDING_LABEL}
            onPress={handleAdd}
          />
          <Button
            className={FIELD_HEIGHT_CLASS_NAME}
            variant="tertiary"
            isDisabled={isPending}
            onPress={closeAddRow}
          >
            {CANCEL_ADD_LABEL}
          </Button>
        </div>
      ) : null}
    </>
  );
}
