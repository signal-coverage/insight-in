"use client";

import { PlusIcon } from "@heroicons/react/24/outline";
import { Button, useOverlayState } from "@heroui/react";
import { useState } from "react";

import { PageHeader } from "@/components/Entries/components/PageHeader";
import { ROOT_CLASS_NAME } from "@/components/Entries/styles";
import { Await } from "@/components/shared/Await";
import type { BoardItem, BoardStatus } from "@/core/roadmap/types";

import { Board } from "./components/Board";
import { DeleteItemDialog } from "./components/DeleteItemDialog";
import { ItemFormDrawer } from "./components/ItemFormDrawer";
import { LoadingBoard } from "./components/LoadingBoard";
import {
  INITIAL_FORM_TARGET,
  NEW_IDEA_LABEL,
  NEW_IDEA_STATUS,
  PAGE_DESCRIPTION,
  PAGE_TITLE,
} from "./consts";
import { NEW_IDEA_ICON_CLASS_NAME } from "./styles";
import type { FormTarget, RoadmapProps } from "./types";

export function Roadmap({ board }: RoadmapProps) {
  const formState = useOverlayState();
  const deleteState = useOverlayState();
  const [formTarget, setFormTarget] = useState<FormTarget>(INITIAL_FORM_TARGET);
  const [itemToDelete, setItemToDelete] = useState<BoardItem | null>(null);

  const openForm = (status: BoardStatus, item: BoardItem | null) => {
    setFormTarget((current) => ({ key: current.key + 1, status, item }));
    formState.open();
  };

  const openDelete = (item: BoardItem) => {
    setItemToDelete(item);
    deleteState.open();
  };

  return (
    <main className={ROOT_CLASS_NAME}>
      <PageHeader
        title={PAGE_TITLE}
        description={PAGE_DESCRIPTION}
        aside={
          <Button onPress={() => openForm(NEW_IDEA_STATUS, null)}>
            <PlusIcon className={NEW_IDEA_ICON_CLASS_NAME} aria-hidden="true" />
            {NEW_IDEA_LABEL}
          </Button>
        }
      />

      <Await source={board} fallback={<LoadingBoard />}>
        {(columns) => (
          <Board
            columns={columns}
            onAdd={(status) => openForm(status, null)}
            onEdit={(item) => openForm(item.status, item)}
            onDelete={openDelete}
          />
        )}
      </Await>

      <ItemFormDrawer
        isOpen={formState.isOpen}
        onOpenChange={formState.setOpen}
        onClose={formState.close}
        target={formTarget}
      />

      <DeleteItemDialog
        isOpen={deleteState.isOpen}
        onOpenChange={deleteState.setOpen}
        onClose={deleteState.close}
        item={itemToDelete}
      />
    </main>
  );
}
