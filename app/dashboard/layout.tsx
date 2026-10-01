import { Navbar } from "@/components/Navbar";
import { Sidebar, SidebarProvider } from "@/components/Sidebar";
import { requireUserId } from "@/lib/auth/requireUserId";

import {
  MAIN_COLUMN_CLASS_NAME,
  PAGE_AREA_CLASS_NAME,
  SHELL_CLASS_NAME,
} from "./styles";

export default async function DashboardLayout({
  children,
}: LayoutProps<"/dashboard">) {
  await requireUserId();

  return (
    <SidebarProvider>
      <div className={SHELL_CLASS_NAME}>
        <Sidebar />
        <div className={MAIN_COLUMN_CLASS_NAME}>
          <Navbar />
          <div className={PAGE_AREA_CLASS_NAME}>{children}</div>
        </div>
      </div>
    </SidebarProvider>
  );
}
