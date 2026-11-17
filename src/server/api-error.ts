import { localeFromRequest, translator } from "@/i18n/server";

/** A JSON error response worded in the language of the request ("errors.<key>" in messages). */
export function apiError(request: Request, key: string, status: number, values?: Record<string, string | number>) {
  return Response.json({ error: translator(localeFromRequest(request))(`errors.${key}`, values) }, { status });
}
