export const LOCALES = ["en", "ar"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "locale";

export const isLocale = (value: string | undefined): value is Locale => LOCALES.includes(value as Locale);
export const direction = (locale: string) => (locale === "ar" ? "rtl" : "ltr");

/** Intl locale for dates and numbers: Arabic text with the Gregorian calendar and Western digits. */
export const intlLocale = (locale: string) => (locale === "ar" ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB");
