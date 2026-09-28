import type { ComponentProps } from "react";
import type { Avatar } from "@heroui/react";

export interface AccountAvatarProps {
  size?: ComponentProps<typeof Avatar>["size"];
}
