import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { ThemeProvider } from "next-themes";
import { Providers } from "@/components/providers";
import { direction } from "@/i18n/config";
import { plexArabic, plexSans, saudiRiyal } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Sales CRM", template: "%s | Sales CRM" },
  description: "AP Plus Insurance Brokerage Sales CRM",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html
      lang={locale}
      dir={direction(locale)}
      className={`${plexSans.variable} ${plexArabic.variable} ${saudiRiyal.variable}`}
      suppressHydrationWarning
    >
      <body>
        <NextIntlClientProvider>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            <Providers>{children}</Providers>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
