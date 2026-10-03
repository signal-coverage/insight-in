import {
  Button,
  Description,
  Disclosure,
  FieldError,
  Header,
  Input,
  Label,
  ListBox,
  Select,
  Separator,
  TextField,
} from "@heroui/react";
import { useState } from "react";

import {
  AMOUNT_HINT,
  AMOUNT_PLACEHOLDER,
} from "@/components/Entries/formConsts";
import {
  FIELD_CLASS_NAME,
  FIELD_HEIGHT_CLASS_NAME,
  FIELD_VARIANT,
  SELECT_TRIGGER_CLASS_NAME,
} from "@/components/Entries/styles";

import {
  CLEAR_ORIGIN_LABEL,
  CRYPTO_SECTION_LABEL,
  CURRENCIES_SECTION_LABEL,
  ORIGIN_AMOUNT_FIELD,
  ORIGIN_CURRENCY_FIELD,
  ORIGIN_CURRENCY_PLACEHOLDER,
} from "./consts";
import {
  BODY_CLASS_NAME,
  CLEAR_BUTTON_CLASS_NAME,
  HINT_CLASS_NAME,
  RATE_LINE_CLASS_NAME,
  SECTION_CLASS_NAME,
  TRIGGER_CLASS_NAME,
} from "./styles";
import type { OriginSectionProps } from "./types";
import { originCurrencyGroups, originRateLine } from "./utils";

// The reference currency of an entry ("Viene de otra moneda" for an income, "Se cotizó en otra
// moneda" for an expense): where the amount came from, or what it was priced in (USDC, another
// currency...), kept only as a reference. It starts closed unless the entry already has an origin.
// What is typed stays when the section is closed and travels with the form, so closing it never loses
// anything; "Quitar origen" is the way to say there is none.
export function OriginSection({
  copy,
  netAmount,
  netCurrency,
  defaultCurrency,
  defaultAmount,
  hasErrors,
}: OriginSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultCurrency !== null);
  const [currency, setCurrency] = useState<string | null>(defaultCurrency);
  const [amount, setAmount] = useState(defaultAmount ?? "");
  // The net currency can change under the origin: it is then no longer a valid origin.
  const originCurrency = currency === netCurrency ? null : currency;
  const groups = originCurrencyGroups(netCurrency);
  const rateLine = originRateLine({
    netAmount,
    netCurrency,
    originAmount: amount,
    originCurrency,
  });
  const hasValues = originCurrency !== null || amount.trim() !== "";

  const clear = () => {
    setCurrency(null);
    setAmount("");
  };

  return (
    <Disclosure
      className={SECTION_CLASS_NAME}
      isExpanded={isOpen || hasErrors}
      onExpandedChange={setIsOpen}
    >
      <Disclosure.Heading>
        <Button
          slot="trigger"
          variant="tertiary"
          size="sm"
          className={TRIGGER_CLASS_NAME}
        >
          {copy.heading}
          <Disclosure.Indicator />
        </Button>
      </Disclosure.Heading>
      <Disclosure.Content>
        <Disclosure.Body className={BODY_CLASS_NAME}>
          <p className={HINT_CLASS_NAME}>{copy.hint}</p>

          <Select
            variant={FIELD_VARIANT}
            className={FIELD_CLASS_NAME}
            name={ORIGIN_CURRENCY_FIELD}
            placeholder={ORIGIN_CURRENCY_PLACEHOLDER}
            value={originCurrency}
            onChange={(value) =>
              setCurrency(typeof value === "string" ? value : null)
            }
          >
            <Label>{copy.currencyLabel}</Label>
            <Select.Trigger className={SELECT_TRIGGER_CLASS_NAME}>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                <ListBox.Section>
                  <Header>{CRYPTO_SECTION_LABEL}</Header>
                  {groups.crypto.map(({ code, label }) => (
                    <ListBox.Item key={code} id={code} textValue={label}>
                      {label}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox.Section>
                <Separator />
                <ListBox.Section>
                  <Header>{CURRENCIES_SECTION_LABEL}</Header>
                  {groups.fiat.map(({ code, label }) => (
                    <ListBox.Item key={code} id={code} textValue={label}>
                      {label}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox.Section>
              </ListBox>
            </Select.Popover>
            <FieldError />
          </Select>

          <TextField
            className={FIELD_CLASS_NAME}
            name={ORIGIN_AMOUNT_FIELD}
            inputMode="decimal"
            value={amount}
            onChange={setAmount}
          >
            <Label>{copy.amountLabel}</Label>
            <Input
              variant={FIELD_VARIANT}
              className={FIELD_HEIGHT_CLASS_NAME}
              placeholder={AMOUNT_PLACEHOLDER}
            />
            <Description>{AMOUNT_HINT}</Description>
            <FieldError />
          </TextField>

          {rateLine ? <p className={RATE_LINE_CLASS_NAME}>{rateLine}</p> : null}

          {hasValues ? (
            <Button
              variant="tertiary"
              size="sm"
              className={CLEAR_BUTTON_CLASS_NAME}
              onPress={clear}
            >
              {CLEAR_ORIGIN_LABEL}
            </Button>
          ) : null}
        </Disclosure.Body>
      </Disclosure.Content>
    </Disclosure>
  );
}
