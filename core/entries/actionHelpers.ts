import { auth } from "@clerk/nextjs/server";

import {
  DUPLICATE_CATEGORY_MESSAGE,
  GENERIC_ERROR_MESSAGE,
  INVALID_CATEGORY_MESSAGE,
  INVALID_FORM_MESSAGE,
  NOT_SIGNED_IN_MESSAGE,
} from "@/core/incomes/consts";
import {
  CategoryNotFoundError,
  DuplicateCategoryError,
} from "@/core/incomes/errors";

// Plumbing shared by the incomes and expenses server actions. It is not a "use server" module:
// nothing here is callable from the browser.

export type FieldErrors = Record<string, string[]>;

export interface ActionFailure {
  status: "error";
  message: string;
  fieldErrors?: FieldErrors;
}

export const failure = (message: string): ActionFailure => ({
  status: "error",
  message,
});

export const fieldFailure = (fieldErrors: FieldErrors): ActionFailure => ({
  status: "error",
  message: INVALID_FORM_MESSAGE,
  fieldErrors,
});

export const readForm = (
  formData: FormData,
  fields: readonly string[],
): Record<string, string | undefined> =>
  Object.fromEntries(
    fields.map((field) => {
      const value = formData.get(field);

      return [field, typeof value === "string" ? value : undefined];
    }),
  );

// Turns the errors the UI can act on into field errors; anything else is unexpected.
const toKnownFailure = (error: unknown): ActionFailure | undefined => {
  if (error instanceof CategoryNotFoundError) {
    return fieldFailure({ categoryId: [INVALID_CATEGORY_MESSAGE] });
  }

  if (error instanceof DuplicateCategoryError) {
    return fieldFailure({ name: [DUPLICATE_CATEGORY_MESSAGE] });
  }

  return undefined;
};

// The owner always comes from the Clerk session, never from client input. `scope` only tags the
// log line of an unexpected failure.
export const runAuthenticated = async <Result extends { status: string }>(
  scope: string,
  run: (userId: string) => Promise<Result>,
): Promise<Result | ActionFailure> => {
  const { userId } = await auth();

  if (!userId) {
    return failure(NOT_SIGNED_IN_MESSAGE);
  }

  try {
    return await run(userId);
  } catch (error) {
    const known = toKnownFailure(error);

    if (known) {
      return known;
    }

    console.error(`[${scope}] action failed`, error);

    return failure(GENERIC_ERROR_MESSAGE);
  }
};
