import { FieldError, Label, Link, ListBox, Select } from "@heroui/react";

import {
  FIELD_CLASS_NAME,
  FIELD_VARIANT,
  SELECT_TRIGGER_CLASS_NAME,
} from "@/components/Entries/styles";
import { BANKS_PATH } from "@/core/banks/consts";

import {
  ACCOUNT_FIELD_NAME,
  ACCOUNT_LABEL,
  ACCOUNT_PLACEHOLDER,
  ARCHIVED_SUFFIX,
  CREATE_ACCOUNT_LINK_LABEL,
  noAccountsHint,
} from "./consts";
import { HINT_CLASS_NAME, ROOT_CLASS_NAME } from "./styles";
import type { AccountFieldProps } from "./types";
import { offeredAccounts, resolveAccountId } from "./utils";

// "Cuenta" of an entry: the account the money moves in. Only the active accounts in the currency of
// the movement are offered (plus the archived one the record already has). The resolved choice travels in a
// hidden input, so the form that contains the field submits it; with no account in the currency, a
// line says so and links to Bancos. That line sits outside the select: HeroUI hides the description
// slot of an invalid select, which would leave the error with no way forward.
export function AccountField({
  accounts,
  currency,
  value,
  keepAccountId = null,
  excludeAccountId = null,
  name = ACCOUNT_FIELD_NAME,
  label = ACCOUNT_LABEL,
  emptyHint,
  onChange,
  errorMessage,
}: AccountFieldProps) {
  const options = offeredAccounts(
    accounts,
    currency,
    keepAccountId,
    excludeAccountId,
  );
  // What is shown and submitted is always the resolved account, so a stale value (the currency
  // changed under it) never reaches the server and the only account of a currency is preselected.
  const resolved = resolveAccountId(
    accounts,
    currency,
    value,
    keepAccountId,
    excludeAccountId,
  );
  const hasError = Boolean(errorMessage);

  return (
    <>
      <div className={ROOT_CLASS_NAME}>
        <Select
          isRequired
          variant={FIELD_VARIANT}
          className={FIELD_CLASS_NAME}
          placeholder={ACCOUNT_PLACEHOLDER}
          value={resolved}
          isDisabled={options.length === 0}
          isInvalid={hasError}
          onChange={(key) => onChange(typeof key === "string" ? key : null)}
        >
          <Label>{label}</Label>
          <Select.Trigger className={SELECT_TRIGGER_CLASS_NAME}>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {options.map(({ id, label, archived }) => (
                <ListBox.Item
                  key={id}
                  id={id}
                  textValue={archived ? `${label}${ARCHIVED_SUFFIX}` : label}
                >
                  {archived ? `${label}${ARCHIVED_SUFFIX}` : label}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
          {hasError ? <FieldError>{errorMessage}</FieldError> : null}
        </Select>
        {options.length === 0 ? (
          <p className={HINT_CLASS_NAME}>
            {emptyHint ?? noAccountsHint(currency)}{" "}
            <Link href={BANKS_PATH}>{CREATE_ACCOUNT_LINK_LABEL}</Link>
          </p>
        ) : null}
      </div>
      <input type="hidden" name={name} value={resolved ?? ""} />
    </>
  );
}
