import { Description, Label, Radio, RadioGroup } from "@heroui/react";

import { CardField } from "@/components/Entries/components/CardField";
import { MediumField } from "@/components/Entries/components/MediumField";
import { FIELD_CLASS_NAME } from "@/components/Entries/styles";

import { CardRecommendations } from "../CardRecommendations";
import { NoCardsNotice } from "./components/NoCardsNotice";
import { OWNERSHIP_LABEL, OWNERSHIP_OPTIONS } from "./consts";
import type { CardOwnershipFieldsProps } from "./types";

// Whose card pays the purchase, and what each answer asks next. An own card is one of the user's
// (always digital money, so no medium): the list under it says which one suits the purchase, it
// informs and never blocks. A borrowed card has no record, so the first installment's date is typed
// (by the form) and the medium says how the lender is repaid.
export function CardOwnershipFields({
  values,
  cards,
  recommendations,
  onChange,
}: CardOwnershipFieldsProps) {
  const isOwn = values.cardOwnership === "own";

  return (
    <>
      <RadioGroup
        className={FIELD_CLASS_NAME}
        orientation="horizontal"
        variant="secondary"
        value={values.cardOwnership}
        onChange={(value) => {
          const option = OWNERSHIP_OPTIONS.find(
            (candidate) => candidate.value === value,
          );

          if (option) {
            onChange({ cardOwnership: option.value });
          }
        }}
      >
        <Label>{OWNERSHIP_LABEL}</Label>
        {OWNERSHIP_OPTIONS.map(({ value, label, description }) => (
          <Radio key={value} value={value}>
            <Radio.Content>
              <Radio.Control>
                <Radio.Indicator />
              </Radio.Control>
              {label}
            </Radio.Content>
            {description ? <Description>{description}</Description> : null}
          </Radio>
        ))}
      </RadioGroup>

      {isOwn && cards.length === 0 ? <NoCardsNotice /> : null}

      {isOwn && cards.length > 0 ? (
        <>
          <CardField
            isRequired
            cards={cards}
            currency={values.currency}
            value={values.cardId}
            onChange={(cardId) => onChange({ cardId })}
          />
          {recommendations ? (
            <CardRecommendations items={recommendations} />
          ) : null}
        </>
      ) : null}

      {isOwn ? null : (
        <MediumField
          defaultMedium={values.medium}
          onChange={(medium) => onChange({ medium })}
        />
      )}
    </>
  );
}
