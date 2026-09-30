import { Navbar } from "@/components/Navbar";
import { Sidebar, SidebarProvider } from "@/components/Sidebar";

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <SidebarProvider>
      <div className="flex h-full flex-row gap-3 bg-[color-mix(in_oklab,var(--background),var(--foreground)_5%)] p-3 pt-0 text-foreground">
        <Sidebar />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <Navbar />
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            {children}
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
}
