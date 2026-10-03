"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  failure,
  fieldFailure,
  readForm,
  runAuthenticated as runScoped,
} from "@/core/entries/actionHelpers";
import type { ActionFailure } from "@/core/entries/actionHelpers";

import {
  CREATE_FORM_FIELDS,
  INVALID_MOVE_MESSAGE,
  ITEM_NOT_FOUND_MESSAGE,
  ROADMAP_PATH,
  UPDATE_FORM_FIELDS,
} from "./consts";
import { BoardItemNotFoundError } from "./errors";
import { createItemSchema, moveItemSchema, updateItemSchema } from "./schema";
import { createItem, deleteItem, moveItem, updateItem } from "./service";
import type { RoadmapActionResult, RoadmapFieldErrors } from "./types";

// The owner always comes from the Clerk session; see runAuthenticated in the helpers.
const runAuthenticated = <Result extends { status: string }>(
  run: (userId: string) => Promise<Result>,
) => runScoped("roadmap", run);

const SUCCESS: RoadmapActionResult = { status: "success" };

// The one error a card can run into that the user can act on. Anything else is unexpected and is
// left for runAuthenticated to log.
const toKnownFailure = (error: unknown): ActionFailure | undefined =>
  error instanceof BoardItemNotFoundError
    ? failure(ITEM_NOT_FOUND_MESSAGE)
    : undefined;

// Runs a write and turns the known failure into the result the UI shows; revalidates the page only
// when the write went through.
const write = async (
  run: () => Promise<unknown>,
): Promise<RoadmapActionResult | ActionFailure> => {
  try {
    await run();
  } catch (error) {
    const known = toKnownFailure(error);

    if (known) {
      return known;
    }

    throw error;
  }

  revalidatePath(ROADMAP_PATH);

  return SUCCESS;
};

// An id that is not text cannot be a card of the user.
const isUsableId = (id: unknown): id is string =>
  typeof id === "string" && id.length > 0;

export async function createItemAction(
  formData: FormData,
): Promise<RoadmapActionResult> {
  return runAuthenticated(async (userId) => {
    const parsed = createItemSchema.safeParse(
      readForm(formData, CREATE_FORM_FIELDS),
    );

    if (!parsed.success) {
      return fieldFailure(
        z.flattenError(parsed.error).fieldErrors as RoadmapFieldErrors,
      );
    }

    return write(() => createItem(userId, parsed.data));
  });
}

// Only the text of a card is edited here; its column changes by moving it.
export async function updateItemAction(
  id: string,
  formData: FormData,
): Promise<RoadmapActionResult> {
  return runAuthenticated(async (userId) => {
    if (!isUsableId(id)) {
      return failure(ITEM_NOT_FOUND_MESSAGE);
    }

    const parsed = updateItemSchema.safeParse(
      readForm(formData, UPDATE_FORM_FIELDS),
    );

    if (!parsed.success) {
      return fieldFailure(
        z.flattenError(parsed.error).fieldErrors as RoadmapFieldErrors,
      );
    }

    return write(() => updateItem(userId, id, parsed.data));
  });
}

// A card dropped in a column (or moved there from its menu). The payload is validated strictly:
// it does not come from a form, so nothing about it is trusted.
export async function moveItemAction(
  input: unknown,
): Promise<RoadmapActionResult> {
  return runAuthenticated(async (userId) => {
    const parsed = moveItemSchema.safeParse(input);

    if (!parsed.success) {
      return failure(INVALID_MOVE_MESSAGE);
    }

    return write(() => moveItem(userId, parsed.data));
  });
}

export async function deleteItemAction(
  id: string,
): Promise<RoadmapActionResult> {
  return runAuthenticated(async (userId) => {
    if (!isUsableId(id)) {
      return failure(ITEM_NOT_FOUND_MESSAGE);
    }

    return write(() => deleteItem(userId, id));
  });
}
