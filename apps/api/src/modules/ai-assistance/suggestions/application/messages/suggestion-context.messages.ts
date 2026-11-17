import type { DayOfWeek } from "@aido/api/vocabulary";

import type { SupportedLocale } from "#api/shared/domain/locale";

interface SuggestionContextTranslations {
  readonly days: Readonly<Record<DayOfWeek, string>>;
}

export const suggestionContextTranslations: Readonly<
  Record<SupportedLocale, SuggestionContextTranslations>
> = {
  ko: {
    days: { MON: "월", TUE: "화", WED: "수", THU: "목", FRI: "금", SAT: "토", SUN: "일" },
  },
  en: {
    days: {
      MON: "Monday",
      TUE: "Tuesday",
      WED: "Wednesday",
      THU: "Thursday",
      FRI: "Friday",
      SAT: "Saturday",
      SUN: "Sunday",
    },
  },
};
