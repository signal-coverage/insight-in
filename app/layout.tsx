import { esES } from "@clerk/localizations";
import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { LocatorSetup } from "@/components/locator-setup";
import { CLERK_APPEARANCE } from "@/lib/clerk-appearance";
import { geistMono, geistSans } from "./fonts";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Insight In",
  description: "Seguimiento de ingresos y gastos",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="h-dvh overflow-hidden">
        <Providers>
          <ClerkProvider
            appearance={CLERK_APPEARANCE}
            localization={esES}
            signInUrl="/"
            signInFallbackRedirectUrl="/dashboard"
          >
            <LocatorSetup />
            {children}
          </ClerkProvider>
        </Providers>
      </body>
    </html>
  );
}
