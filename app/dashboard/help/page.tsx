import { Help } from "@/components/Help";
import { requireUserId } from "@/lib/auth/requireUserId";

export default async function HelpPage() {
  await requireUserId();

  return <Help />;
}
