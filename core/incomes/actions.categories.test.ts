import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  revalidatePath: vi.fn(),
  renameCategory: vi.fn(),
  deleteCategory: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("./service", () => ({
  createIncome: vi.fn(),
  updateIncome: vi.fn(),
  deleteIncome: vi.fn(),
  createCategory: vi.fn(),
  renameCategory: mocks.renameCategory,
  deleteCategory: mocks.deleteCategory,
}));

import { deleteCategoryAction, renameCategoryAction } from "./actions";
import {
  CategoryInUseError,
  CategoryNotFoundError,
  DuplicateCategoryError,
  LastCategoryError,
} from "./errors";

const USER_ID = "user_123";

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.auth.mockResolvedValue({ userId: USER_ID });
});

describe("renameCategoryAction", () => {
  it("rejects unauthenticated callers", async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    const result = await renameCategoryAction("c1", "Pay");

    expect(result).toEqual({
      status: "error",
      message: "Debes iniciar sesión.",
    });
    expect(mocks.renameCategory).not.toHaveBeenCalled();
  });

  it("returns a name field error for an invalid name", async () => {
    const result = await renameCategoryAction("c1", "   ");

    expect(result.status === "error" && result.fieldErrors).toHaveProperty(
      "name",
    );
    expect(mocks.renameCategory).not.toHaveBeenCalled();
  });

  it("rejects an empty id", async () => {
    const result = await renameCategoryAction("", "Pay");

    expect(result.status).toBe("error");
    expect(mocks.renameCategory).not.toHaveBeenCalled();
  });

  it("renames for the authenticated user with a trimmed name and revalidates", async () => {
    mocks.renameCategory.mockResolvedValue({ id: "c1", name: "Pay" });

    const result = await renameCategoryAction("c1", "  Pay  ");

    expect(result).toEqual({
      status: "success",
      category: { id: "c1", name: "Pay" },
    });
    expect(mocks.renameCategory).toHaveBeenCalledWith(USER_ID, "c1", "Pay");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/incomes");
  });

  it("reports a duplicate as a name field error", async () => {
    mocks.renameCategory.mockRejectedValue(new DuplicateCategoryError());

    const result = await renameCategoryAction("c1", "Gifts");

    expect(result).toEqual({
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: { name: ["Ya tienes una categoría con este nombre."] },
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("reports a missing category with a plain message", async () => {
    mocks.renameCategory.mockRejectedValue(new CategoryNotFoundError());

    const result = await renameCategoryAction("c1", "Pay");

    expect(result).toEqual({
      status: "error",
      message: "No se encontró la categoría.",
    });
  });

  it("returns a generic error when the service fails", async () => {
    mocks.renameCategory.mockRejectedValue(new Error("boom"));

    const result = await renameCategoryAction("c1", "Pay");

    expect(result).toEqual({
      status: "error",
      message: "Algo salió mal. Inténtalo de nuevo.",
    });
  });
});

describe("deleteCategoryAction", () => {
  it("rejects unauthenticated callers", async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    const result = await deleteCategoryAction("c1");

    expect(result.status).toBe("error");
    expect(mocks.deleteCategory).not.toHaveBeenCalled();
  });

  it("rejects an empty id", async () => {
    const result = await deleteCategoryAction("  ");

    expect(result.status).toBe("error");
    expect(mocks.deleteCategory).not.toHaveBeenCalled();
  });

  it("deletes for the authenticated user and revalidates", async () => {
    mocks.deleteCategory.mockResolvedValue(undefined);

    const result = await deleteCategoryAction("c1");

    expect(result).toEqual({ status: "success" });
    expect(mocks.deleteCategory).toHaveBeenCalledWith(USER_ID, "c1");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/incomes");
  });

  it("reports a missing category", async () => {
    mocks.deleteCategory.mockRejectedValue(new CategoryNotFoundError());

    expect(await deleteCategoryAction("c1")).toEqual({
      status: "error",
      message: "No se encontró la categoría.",
    });
  });

  it("explains that incomes still use the category, with the count", async () => {
    mocks.deleteCategory.mockRejectedValue(new CategoryInUseError(3));

    expect(await deleteCategoryAction("c1")).toEqual({
      status: "error",
      message:
        "3 ingresos todavía usan esta categoría. Muévelos o elimínalos primero.",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("uses the singular form for a single income", async () => {
    mocks.deleteCategory.mockRejectedValue(new CategoryInUseError(1));

    expect(await deleteCategoryAction("c1")).toEqual({
      status: "error",
      message:
        "1 ingreso todavía usa esta categoría. Muévelo o elimínalo primero.",
    });
  });

  it("explains that recurring incomes still use the category", async () => {
    mocks.deleteCategory.mockRejectedValue(new CategoryInUseError(0, 2));

    expect(await deleteCategoryAction("c1")).toEqual({
      status: "error",
      message:
        "2 ingresos recurrentes todavía usan esta categoría. Muévelos o elimínalos primero.",
    });
  });

  it("uses the singular form for a single recurring income", async () => {
    mocks.deleteCategory.mockRejectedValue(new CategoryInUseError(0, 1));

    expect(await deleteCategoryAction("c1")).toEqual({
      status: "error",
      message:
        "1 ingreso recurrente todavía usa esta categoría. Muévelo o elimínalo primero.",
    });
  });

  it("mentions both incomes and recurring incomes when both use the category", async () => {
    mocks.deleteCategory.mockRejectedValue(new CategoryInUseError(3, 1));

    expect(await deleteCategoryAction("c1")).toEqual({
      status: "error",
      message:
        "3 ingresos y 1 ingreso recurrente todavía usan esta categoría. Muévelos o elimínalos primero.",
    });
  });

  it("explains that loans repaid in installments still use the category", async () => {
    mocks.deleteCategory.mockRejectedValue(new CategoryInUseError(0, 0, 2));

    expect(await deleteCategoryAction("c1")).toEqual({
      status: "error",
      message:
        "2 devoluciones en cuotas todavía usan esta categoría. Muévelas o elimínalas primero.",
    });
  });

  it("uses the singular form for a single loan repaid in installments", async () => {
    mocks.deleteCategory.mockRejectedValue(new CategoryInUseError(0, 0, 1));

    expect(await deleteCategoryAction("c1")).toEqual({
      status: "error",
      message:
        "1 devolución en cuotas todavía usa esta categoría. Muévela o elimínala primero.",
    });
  });

  it("mentions incomes and loans repaid in installments together", async () => {
    mocks.deleteCategory.mockRejectedValue(new CategoryInUseError(5, 0, 1));

    expect(await deleteCategoryAction("c1")).toEqual({
      status: "error",
      message:
        "5 ingresos y 1 devolución en cuotas todavía usan esta categoría. Muévelos o elimínalos primero.",
    });
  });

  it("refuses to delete the last category", async () => {
    mocks.deleteCategory.mockRejectedValue(new LastCategoryError());

    expect(await deleteCategoryAction("c1")).toEqual({
      status: "error",
      message: "Se necesita al menos una categoría.",
    });
  });

  it("returns a generic error when the service fails", async () => {
    mocks.deleteCategory.mockRejectedValue(new Error("boom"));

    expect(await deleteCategoryAction("c1")).toEqual({
      status: "error",
      message: "Algo salió mal. Inténtalo de nuevo.",
    });
  });
});
