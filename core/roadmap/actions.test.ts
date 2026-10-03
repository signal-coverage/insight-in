import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  revalidatePath: vi.fn(),
  createItem: vi.fn(),
  updateItem: vi.fn(),
  moveItem: vi.fn(),
  deleteItem: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("./service", () => ({
  createItem: mocks.createItem,
  updateItem: mocks.updateItem,
  moveItem: mocks.moveItem,
  deleteItem: mocks.deleteItem,
}));

import {
  createItemAction,
  deleteItemAction,
  moveItemAction,
  updateItemAction,
} from "./actions";
import { BoardItemNotFoundError } from "./errors";

const USER_ID = "user_123";

const formOf = (patch: Record<string, string> = {}): FormData => {
  const values: Record<string, string> = {
    title: "Modo oscuro",
    description: "Para la noche",
    status: "IDEA",
    ...patch,
  };
  const formData = new FormData();

  Object.entries(values).forEach(([key, value]) => formData.set(key, value));

  return formData;
};

const NOT_SIGNED_IN = { status: "error", message: "Debes iniciar sesión." };
const NOT_FOUND = { status: "error", message: "No se encontró la tarjeta." };
const GENERIC = {
  status: "error",
  message: "Algo salió mal. Inténtalo de nuevo.",
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.auth.mockResolvedValue({ userId: USER_ID });
});

describe("createItemAction", () => {
  it("rejects unauthenticated callers without touching the service", async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    expect(await createItemAction(formOf())).toEqual(NOT_SIGNED_IN);
    expect(mocks.createItem).not.toHaveBeenCalled();
  });

  it("returns field errors for invalid input without touching the service", async () => {
    const result = await createItemAction(
      formOf({ title: "  ", status: "DOING" }),
    );

    expect(result.status === "error" && result.message).toBe(
      "Corrige los campos resaltados.",
    );
    expect(result.status === "error" && result.fieldErrors).toEqual({
      title: ["El título es obligatorio."],
      status: ["Elegí una columna válida."],
    });
    expect(mocks.createItem).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("creates the card for the authenticated user in the column asked for", async () => {
    mocks.createItem.mockResolvedValue({});

    expect(await createItemAction(formOf({ status: "TODO" }))).toEqual({
      status: "success",
    });
    expect(mocks.createItem).toHaveBeenCalledWith(USER_ID, {
      title: "Modo oscuro",
      description: "Para la noche",
      status: "TODO",
      index: undefined,
    });
  });

  it("passes the place when the form carries one", async () => {
    mocks.createItem.mockResolvedValue({});

    await createItemAction(formOf({ index: "2" }));

    expect(mocks.createItem.mock.calls[0][1].index).toBe(2);
  });

  it("ignores a userId in the form", async () => {
    const formData = formOf();

    formData.set("userId", "attacker");
    mocks.createItem.mockResolvedValue({});

    await createItemAction(formData);

    expect(mocks.createItem.mock.calls[0][0]).toBe(USER_ID);
    expect(mocks.createItem.mock.calls[0][1]).not.toHaveProperty("userId");
  });

  it("revalidates the roadmap page", async () => {
    mocks.createItem.mockResolvedValue({});

    await createItemAction(formOf());

    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/roadmap");
  });

  it("returns a generic error when the service fails", async () => {
    mocks.createItem.mockRejectedValue(new Error("db down"));

    expect(await createItemAction(formOf())).toEqual(GENERIC);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("updateItemAction", () => {
  it("rejects unauthenticated callers without touching the service", async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    expect(await updateItemAction("item_1", formOf())).toEqual(NOT_SIGNED_IN);
    expect(mocks.updateItem).not.toHaveBeenCalled();
  });

  it("returns field errors for invalid input without touching the service", async () => {
    const result = await updateItemAction(
      "item_1",
      formOf({ title: "a".repeat(121) }),
    );

    expect(result.status === "error" && result.fieldErrors).toEqual({
      title: ["El título no puede superar los 120 caracteres."],
    });
    expect(mocks.updateItem).not.toHaveBeenCalled();
  });

  it("updates the text of the user's card and revalidates the page, leaving the column alone", async () => {
    mocks.updateItem.mockResolvedValue(undefined);

    expect(
      await updateItemAction("item_1", formOf({ status: "DONE" })),
    ).toEqual({ status: "success" });
    expect(mocks.updateItem).toHaveBeenCalledWith(USER_ID, "item_1", {
      title: "Modo oscuro",
      description: "Para la noche",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/roadmap");
  });

  it("says the card was not found when it is not the user's", async () => {
    mocks.updateItem.mockRejectedValue(new BoardItemNotFoundError());

    expect(await updateItemAction("item_9", formOf())).toEqual(NOT_FOUND);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("refuses an id that is not a text without touching the service", async () => {
    expect(await updateItemAction(undefined as never, formOf())).toEqual(
      NOT_FOUND,
    );
    expect(mocks.updateItem).not.toHaveBeenCalled();
  });
});

describe("moveItemAction", () => {
  const MOVE = { id: "item_1", status: "DONE", index: 1 };

  it("rejects unauthenticated callers without touching the service", async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    expect(await moveItemAction(MOVE)).toEqual(NOT_SIGNED_IN);
    expect(mocks.moveItem).not.toHaveBeenCalled();
  });

  it("moves the card of the authenticated user and revalidates the page", async () => {
    mocks.moveItem.mockResolvedValue(undefined);

    expect(await moveItemAction(MOVE)).toEqual({ status: "success" });
    expect(mocks.moveItem).toHaveBeenCalledWith(USER_ID, MOVE);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/roadmap");
  });

  it.each([
    ["an unknown column", { ...MOVE, status: "DOING" }],
    ["a negative place", { ...MOVE, index: -1 }],
    ["no id", { status: "DONE", index: 0 }],
    ["something that is not an object", "item_1"],
    ["nothing", undefined],
  ])("refuses %s without touching the service", async (_name, input) => {
    expect(await moveItemAction(input)).toEqual({
      status: "error",
      message: "No se pudo mover la tarjeta.",
    });
    expect(mocks.moveItem).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("ignores a userId in the payload", async () => {
    mocks.moveItem.mockResolvedValue(undefined);

    await moveItemAction({ ...MOVE, userId: "attacker" });

    expect(mocks.moveItem).toHaveBeenCalledWith(USER_ID, MOVE);
  });

  it("says the card was not found when it is not the user's", async () => {
    mocks.moveItem.mockRejectedValue(new BoardItemNotFoundError());

    expect(await moveItemAction(MOVE)).toEqual(NOT_FOUND);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("returns a generic error when the service fails", async () => {
    mocks.moveItem.mockRejectedValue(new Error("db down"));

    expect(await moveItemAction(MOVE)).toEqual(GENERIC);
  });
});

describe("deleteItemAction", () => {
  it("rejects unauthenticated callers without touching the service", async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    expect(await deleteItemAction("item_1")).toEqual(NOT_SIGNED_IN);
    expect(mocks.deleteItem).not.toHaveBeenCalled();
  });

  it("deletes the card of the authenticated user and revalidates the page", async () => {
    mocks.deleteItem.mockResolvedValue(undefined);

    expect(await deleteItemAction("item_1")).toEqual({ status: "success" });
    expect(mocks.deleteItem).toHaveBeenCalledWith(USER_ID, "item_1");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/roadmap");
  });

  it("says the card was not found when it is not the user's", async () => {
    mocks.deleteItem.mockRejectedValue(new BoardItemNotFoundError());

    expect(await deleteItemAction("item_9")).toEqual(NOT_FOUND);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("refuses an id that is not a text without touching the service", async () => {
    expect(await deleteItemAction(undefined as never)).toEqual(NOT_FOUND);
    expect(mocks.deleteItem).not.toHaveBeenCalled();
  });

  it("returns a generic error when the service fails", async () => {
    mocks.deleteItem.mockRejectedValue(new Error("db down"));

    expect(await deleteItemAction("item_1")).toEqual(GENERIC);
  });
});
