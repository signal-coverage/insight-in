import { requireUserId } from "@/lib/auth/requireUserId";
import { PlaceholderPage } from "@/components/shared/PlaceholderPage";

export default async function CalendarPage() {
  await requireUserId();

  return <PlaceholderPage title="Calendario" />;
}
