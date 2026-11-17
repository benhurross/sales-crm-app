import { IBM_Plex_Sans, IBM_Plex_Sans_Arabic } from "next/font/google";
import localFont from "next/font/local";

export const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-plex",
  display: "swap",
});

export const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-arabic",
  display: "swap",
});

/** Draws the Saudi Riyal sign (U+20C1), which most system fonts lack. */
export const saudiRiyal = localFont({
  src: [
    { path: "../assets/fonts/saudi-riyal.woff2", weight: "400" },
    { path: "../assets/fonts/saudi-riyal-bold.woff2", weight: "700" },
  ],
  variable: "--font-riyal",
  display: "swap",
  // The font only covers the Riyal sign; a generated fallback would take over all other text ahead of IBM Plex.
  adjustFontFallback: false,
  declarations: [{ prop: "unicode-range", value: "U+20C1, U+E900" }],
});
