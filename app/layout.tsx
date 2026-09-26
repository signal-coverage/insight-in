import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Navbar } from "@/components/Navbar";
import { Sidebar, SidebarProvider } from "@/components/Sidebar";
import { LocatorSetup } from "@/components/locator-setup";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Insight In",
  description: "Income and expense tracker",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-dvh overflow-hidden">
        <LocatorSetup />
        <SidebarProvider>
          <div className="flex h-full flex-row gap-3 bg-[color-mix(in_oklab,var(--background),var(--foreground)_5%)] p-3 text-foreground">
            <Sidebar />
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <Navbar />
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                {children}
              </div>
            </div>
          </div>
        </SidebarProvider>
      </body>
    </html>
  );
}
