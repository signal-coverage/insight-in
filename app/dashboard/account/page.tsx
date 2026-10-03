import { Account } from "@/components/Account";
import { requireUserId } from "@/lib/auth/requireUserId";

export default async function AccountPage() {
  await requireUserId();

  return <Account />;
}
