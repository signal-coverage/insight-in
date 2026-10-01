import { Button, Drawer, useOverlayState } from "@heroui/react";
import { useState } from "react";

import type {
  CategoryWithCount,
  EntryCategory,
} from "@/components/Entries/types";

import { AddCategoryRow } from "./components/AddCategoryRow";
import { CategoryRow } from "./components/CategoryRow";
import { DeleteCategoryDialog } from "./components/DeleteCategoryDialog";
import { CLOSE_LABEL } from "./consts";
import { DESCRIPTION_CLASS_NAME, LIST_CLASS_NAME } from "./styles";
import type { ManageCategoriesContentProps } from "./types";
import { sortCategories } from "./utils";

// Keeps its own copy of the list so an add, rename or delete shows up immediately; the server
// revalidation refreshes the page data behind it.
export function ManageCategoriesContent({
  categories,
  copy,
  actions,
  onClose,
}: ManageCategoriesContentProps) {
  const [items, setItems] = useState(() => sortCategories(categories));
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [categoryToDelete, setCategoryToDelete] =
    useState<CategoryWithCount | null>(null);
  const deleteState = useOverlayState();

  const clearRowError = (id: string) =>
    setRowErrors((current) => {
      const next = { ...current };

      delete next[id];

      return next;
    });

  const handleRename = async (id: string, name: string) => {
    clearRowError(id);

    const result = await actions.rename(id, name);

    if (result.status === "success") {
      setItems((current) =>
        sortCategories(
          current.map((item) =>
            item.id === id ? { ...item, name: result.category.name } : item,
          ),
        ),
      );
    }

    return result;
  };

  const handleAdded = (category: EntryCategory) =>
    setItems((current) =>
      sortCategories([...current, { ...category, count: 0 }]),
    );

  const handleDeleteRequest = (category: CategoryWithCount) => {
    clearRowError(category.id);
    setCategoryToDelete(category);
    deleteState.open();
  };

  const handleDeleteConfirm = async () => {
    if (!categoryToDelete) {
      return;
    }

    const { id } = categoryToDelete;
    const result = await actions.remove(id);

    if (result.status === "success") {
      setItems((current) => current.filter((item) => item.id !== id));
    } else {
      setRowErrors((current) => ({ ...current, [id]: result.message }));
    }

    deleteState.close();
  };

  return (
    <>
      <Drawer.CloseTrigger />
      <Drawer.Header>
        <Drawer.Heading>{copy.heading}</Drawer.Heading>
        <p className={DESCRIPTION_CLASS_NAME}>{copy.description}</p>
      </Drawer.Header>
      <Drawer.Body>
        <AddCategoryRow onCreate={actions.create} onAdded={handleAdded} />
        <ul className={LIST_CLASS_NAME} aria-label={copy.listAriaLabel}>
          {items.map((category) => (
            <CategoryRow
              key={category.id}
              category={category}
              countLabel={copy.countLabel(category.count)}
              error={rowErrors[category.id]}
              onRename={handleRename}
              onDelete={handleDeleteRequest}
            />
          ))}
        </ul>
      </Drawer.Body>
      <Drawer.Footer>
        <Button slot="close" variant="tertiary" onPress={onClose}>
          {CLOSE_LABEL}
        </Button>
      </Drawer.Footer>

      <DeleteCategoryDialog
        isOpen={deleteState.isOpen}
        onOpenChange={deleteState.setOpen}
        onClose={deleteState.close}
        category={categoryToDelete}
        onConfirm={handleDeleteConfirm}
      />
    </>
  );
}
