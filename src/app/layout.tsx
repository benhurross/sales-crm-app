import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { Providers } from "@/components/providers";
import { plexArabic, plexSans } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Sales CRM", template: "%s | Sales CRM" },
  description: "AP Plus Insurance Brokerage Sales CRM",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${plexSans.variable} ${plexArabic.variable}`} suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <Providers>{children}</Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
