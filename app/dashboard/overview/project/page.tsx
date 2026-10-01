import { requireUserId } from "@/lib/auth/requireUserId";
import { PlaceholderPage } from "@/components/shared/PlaceholderPage";

export default async function OverviewProjectPage() {
  await requireUserId();

  return <PlaceholderPage title="Proyecto" />;
}
