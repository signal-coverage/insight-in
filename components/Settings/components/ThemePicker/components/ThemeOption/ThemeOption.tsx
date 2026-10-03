import { Radio } from "@heroui/react";

import { ThemeSwatches } from "../ThemeSwatches";
import {
  CONTENT_CLASS_NAME,
  DETAILS_CLASS_NAME,
  LABEL_CLASS_NAME,
} from "./styles";
import type { ThemeOptionProps } from "./types";

// One theme: its name and, under it, its five colours. The name is what the radio is called; the
// colours are only there to look at.
export function ThemeOption({ theme }: ThemeOptionProps) {
  return (
    <Radio value={theme.id}>
      <Radio.Content className={CONTENT_CLASS_NAME}>
        <Radio.Control>
          <Radio.Indicator />
        </Radio.Control>
        <span className={DETAILS_CLASS_NAME}>
          <span className={LABEL_CLASS_NAME}>{theme.label}</span>
          <ThemeSwatches colors={theme.colors} />
        </span>
      </Radio.Content>
    </Radio>
  );
}
