import { Header, ListBox, Separator } from "@heroui/react";

import {
  CRYPTO_CURRENCY_OPTIONS,
  CURRENCY_OPTIONS,
} from "@/components/Entries/currencyOptions";

import { CRYPTO_SECTION_LABEL, LEGAL_TENDER_SECTION_LABEL } from "./consts";
import type { CurrencyListBoxProps } from "./types";

// The list inside a currency Select: the legal-tender currencies, and, where the field takes them, the
// crypto assets in a group of their own after them. Credit card caps and the planners never pass
// `includeCrypto`.
export function CurrencyListBox({
  includeCrypto,
  cryptoFirst = false,
}: CurrencyListBoxProps) {
  if (!includeCrypto) {
    return (
      <ListBox>
        {CURRENCY_OPTIONS.map(({ code, label }) => (
          <ListBox.Item key={code} id={code} textValue={label}>
            {label}
            <ListBox.ItemIndicator />
          </ListBox.Item>
        ))}
      </ListBox>
    );
  }

  const legalTender = (
    <ListBox.Section>
      <Header>{LEGAL_TENDER_SECTION_LABEL}</Header>
      {CURRENCY_OPTIONS.map(({ code, label }) => (
        <ListBox.Item key={code} id={code} textValue={label}>
          {label}
          <ListBox.ItemIndicator />
        </ListBox.Item>
      ))}
    </ListBox.Section>
  );
  const crypto = (
    <ListBox.Section>
      <Header>{CRYPTO_SECTION_LABEL}</Header>
      {CRYPTO_CURRENCY_OPTIONS.map(({ code, label }) => (
        <ListBox.Item key={code} id={code} textValue={label}>
          {label}
          <ListBox.ItemIndicator />
        </ListBox.Item>
      ))}
    </ListBox.Section>
  );

  return (
    <ListBox>
      {cryptoFirst ? crypto : legalTender}
      <Separator />
      {cryptoFirst ? legalTender : crypto}
    </ListBox>
  );
}
