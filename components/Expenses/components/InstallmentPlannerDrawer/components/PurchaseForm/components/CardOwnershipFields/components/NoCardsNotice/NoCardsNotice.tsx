import { Button } from "@heroui/react";
import { useRouter } from "next/navigation";

import { CARDS_PATH } from "@/core/cards/consts";

import { GO_TO_CARDS_LABEL, NO_CARDS_MESSAGE } from "./consts";
import { LINK_CLASS_NAME, MESSAGE_CLASS_NAME, ROOT_CLASS_NAME } from "./styles";

// What an own-card purchase says when the user has no cards at all: where to add one. The form can
// only go on as a borrowed card until then.
export function NoCardsNotice() {
  const router = useRouter();

  return (
    <div className={ROOT_CLASS_NAME}>
      <p className={MESSAGE_CLASS_NAME}>{NO_CARDS_MESSAGE}</p>
      <Button
        variant="ghost"
        className={LINK_CLASS_NAME}
        onPress={() => router.push(CARDS_PATH)}
      >
        {GO_TO_CARDS_LABEL}
      </Button>
    </div>
  );
}
