import {
  createCategoryAction,
  deleteCategoryAction,
  renameCategoryAction,
} from "@/core/incomes/actions";

// What the shared category drawer and field call, bound to the income actions. Kept out of
// consts.ts so the constants stay free of server code.
export const CATEGORY_ACTIONS = {
  create: createCategoryAction,
  rename: renameCategoryAction,
  remove: deleteCategoryAction,
};
