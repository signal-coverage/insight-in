import { redirect } from "next/navigation";

import { SUMMARY_PATH } from "@/components/Summary/consts";
import { requireUserId } from "@/lib/auth/requireUserId";

// The panel's home is the summary (General, under Resumen): it has one address, and this one just
// leads there, so the breadcrumb's "Panel" and the sign-in redirect land on a real page.
export default async function Home() {
  await requireUserId();

  redirect(SUMMARY_PATH);
}
