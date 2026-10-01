// Kept apart from the service so actions can branch on them (and tests can mock the
// service) without the classes disappearing with it.

export class CategoryNotFoundError extends Error {
  constructor() {
    super("Category not found for this user");
    this.name = "CategoryNotFoundError";
  }
}

export class DuplicateCategoryError extends Error {
  constructor() {
    super("A category with this name already exists");
    this.name = "DuplicateCategoryError";
  }
}

export class CategoryInUseError extends Error {
  // How many incomes and how many recurring incomes still use the category.
  constructor(
    readonly count: number,
    readonly recurringCount = 0,
  ) {
    super(
      `Category is used by ${count} income(s) and ${recurringCount} recurring income(s)`,
    );
    this.name = "CategoryInUseError";
  }
}

export class LastCategoryError extends Error {
  constructor() {
    super("The last remaining category cannot be deleted");
    this.name = "LastCategoryError";
  }
}
