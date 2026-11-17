import { createTranslator } from "use-intl/core";
import ar from "../../messages/ar.json";
import en from "../../messages/en.json";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from "./config";

const MESSAGES = { en, ar };

export type Translate = (key: string, values?: Record<string, string | number>) => string;

/** The language chosen in the browser (the locale cookie sent with the request). */
export function localeFromRequest(request: Request): Locale {
  const match = request.headers.get("cookie")?.match(new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE}=(\\w+)`));
  return isLocale(match?.[1]) ? match[1] : DEFAULT_LOCALE;
}

/** Translator over all messages, for server code outside React (exports, emails, API errors). */
export function translator(locale: Locale): Translate {
  return createTranslator({ locale, messages: MESSAGES[locale] }) as unknown as Translate;
}
