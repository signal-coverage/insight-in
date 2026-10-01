"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { Button } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { shiftMonth } from "@/core/summary/month";

import { CURRENT_LABEL, NAV_LABEL, NEXT_LABEL, PREVIOUS_LABEL } from "./consts";
import { ICON_CLASS_NAME, LABEL_CLASS_NAME, ROOT_CLASS_NAME } from "./styles";
import type { MonthSelectorProps } from "./types";
import { monthHref } from "./utils";

// Previous and next month around the month's name, and the way back to the month in course while
// another one is shown. The month lives in the address, so a month can be shared and reloaded.
export function MonthSelector({
  month,
  label,
  currentMonth,
}: MonthSelectorProps) {
  const router = useRouter();
  // The navigation is a transition so that the page stays usable while the next month loads.
  const [, startNavigation] = useTransition();

  const goTo = (target: string) =>
    startNavigation(() => router.push(monthHref(target, currentMonth)));

  return (
    <nav aria-label={NAV_LABEL} className={ROOT_CLASS_NAME}>
      <Button
        isIconOnly
        variant="secondary"
        aria-label={PREVIOUS_LABEL}
        onPress={() => goTo(shiftMonth(month, -1))}
      >
        <ChevronLeftIcon className={ICON_CLASS_NAME} aria-hidden="true" />
      </Button>
      <span aria-live="polite" className={LABEL_CLASS_NAME}>
        {label}
      </span>
      <Button
        isIconOnly
        variant="secondary"
        aria-label={NEXT_LABEL}
        onPress={() => goTo(shiftMonth(month, 1))}
      >
        <ChevronRightIcon className={ICON_CLASS_NAME} aria-hidden="true" />
      </Button>
      {month === currentMonth ? null : (
        <Button variant="tertiary" onPress={() => goTo(currentMonth)}>
          {CURRENT_LABEL}
        </Button>
      )}
    </nav>
  );
}
