import { UserProfile } from "@clerk/nextjs";

import { PageHeader } from "@/components/Entries/components/PageHeader";
import { USER_PROFILE_APPEARANCE } from "@/lib/clerk-appearance";

import { PAGE_DESCRIPTION, PAGE_TITLE } from "./consts";
import { PROFILE_CLASS_NAME, ROOT_CLASS_NAME } from "./styles";

// The person's own account: name, photo, email, password, security and open sessions. Clerk draws
// all of it (in Spanish, with the app's colours); the page only gives it a header and its place.
// The hash routing keeps the profile's own pages (#/security, ...) inside this one address.
export function Account() {
  return (
    <main className={ROOT_CLASS_NAME}>
      <PageHeader title={PAGE_TITLE} description={PAGE_DESCRIPTION} />

      <div className={PROFILE_CLASS_NAME}>
        <UserProfile routing="hash" appearance={USER_PROFILE_APPEARANCE} />
      </div>
    </main>
  );
}
