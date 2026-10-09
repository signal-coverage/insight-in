import { Link } from "@heroui/react";

import { InlineAlert } from "@/components/shared/InlineAlert";

import { BLOCK_ERROR_MESSAGE, RETRY_LABEL } from "./consts";
import type { BlockErrorProps } from "./types";

// What a block of the overview shows when its numbers could not be read: the rest of the page stays.
export function BlockError({ retryHref }: BlockErrorProps) {
  return (
    <InlineAlert variant="error">
      {BLOCK_ERROR_MESSAGE} <Link href={retryHref}>{RETRY_LABEL}</Link>
    </InlineAlert>
  );
}
