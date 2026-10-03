// Full-height column: header and totals keep their natural size, the table box takes the
// rest (min-h-0 lets it shrink below its content so it scrolls internally).
export const ROOT_CLASS_NAME =
  "flex h-full min-h-0 flex-1 flex-col gap-4 pt-3 px-4";

export const ADD_ICON_CLASS_NAME = "size-4";

// Shared look of every single-line control in the Incomes drawers: one fixed height and
// HeroUI's "secondary" variant, so fields stay visible on the drawer background. Only
// multi-row inputs (the notes TextArea) are exempt from the height.
export const FIELD_HEIGHT_CLASS_NAME = "h-10";

export const FIELD_VARIANT = "secondary" as const;

// The global `button` rule caps width at fit-content; `app-button--full-width` opts out so
// a Select trigger fills its field like an input does.
export const SELECT_TRIGGER_CLASS_NAME = `app-button--full-width w-full ${FIELD_HEIGHT_CLASS_NAME}`;

// Field wrapper and form layout shared by the drawers' forms.
export const FIELD_CLASS_NAME = "w-full";

export const FORM_CLASS_NAME = "flex flex-col gap-4 p-1";

// Full width on mobile, capped at max-w-md from `sm` up. HeroUI's own right-placement
// width (`w-80 sm:w-96`) lives in the components layer, so this utility wins.
export const DRAWER_DIALOG_CLASS_NAME = "w-full max-w-full sm:max-w-md";

export const DRAWER_DESCRIPTION_CLASS_NAME =
  "mt-1.5 text-sm leading-5 text-muted";

// The amount and currency side by side in an entry form.
export const AMOUNT_ROW_CLASS_NAME = "grid grid-cols-1 gap-4 sm:grid-cols-2";
