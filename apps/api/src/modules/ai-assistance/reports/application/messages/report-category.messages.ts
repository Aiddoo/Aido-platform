import type { SupportedLocale } from "#api/shared/domain/locale";

export const FALLBACK_CATEGORY_NAMES = {
  ko: "기타",
  en: "Other",
} satisfies Record<SupportedLocale, string>;
