import { Settings } from "@/components/Settings";
import { getUserSettings } from "@/core/settings/service";
import { requireUserId } from "@/lib/auth/requireUserId";

export default async function SettingsPage() {
  const userId = await requireUserId();

  // Not awaited on purpose, like the summary's: the header is on screen at once and only the
  // switch waits for its saved value.
  const includeExpectedIncomes = getUserSettings(userId).then(
    ({ includeExpectedIncomes: isSelected }) => isSelected,
  );

  return <Settings includeExpectedIncomes={includeExpectedIncomes} />;
}
