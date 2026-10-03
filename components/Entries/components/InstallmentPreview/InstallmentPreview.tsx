import { PREVIEW_HINT } from "./consts";
import { PREVIEW_CLASS_NAME, PREVIEW_HINT_CLASS_NAME } from "./styles";
import type { InstallmentPreviewProps } from "./types";

// The live line under the inputs of a plan in installments, or a hint to complete the data.
export function InstallmentPreview({ text }: InstallmentPreviewProps) {
  return text ? (
    <p className={PREVIEW_CLASS_NAME} aria-live="polite">
      {text}
    </p>
  ) : (
    <p className={PREVIEW_HINT_CLASS_NAME}>{PREVIEW_HINT}</p>
  );
}
