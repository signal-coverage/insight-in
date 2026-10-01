import { Label, Skeleton } from "@heroui/react";

import { FIELD_HEIGHT_CLASS_NAME } from "@/components/Entries/styles";
import type { FilterSelectSkeletonProps } from "../../types";

// What a FilterSelect looks like before its options arrive: the real label (it needs no data)
// over a field-sized skeleton in place of the trigger, at the same height so nothing shifts.
export function FilterSelectSkeleton({
  label,
  className,
}: FilterSelectSkeletonProps) {
  return (
    <div className={`${className} flex flex-col gap-1`} aria-busy="true">
      <Label>{label}</Label>
      <Skeleton
        className={`${FIELD_HEIGHT_CLASS_NAME} w-full rounded-[var(--field-radius)]`}
      />
    </div>
  );
}
