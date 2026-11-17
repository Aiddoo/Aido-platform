import { DAY_OF_WEEK_KO, type DayOfWeek } from "@aido/api/vocabulary";

import type { SupportedLocale } from "#api/shared/domain/locale";

interface SuggestionContextTranslations {
  readonly days: Readonly<Record<DayOfWeek, string>>;
}

export const suggestionContextTranslations: Readonly<
  Record<SupportedLocale, SuggestionContextTranslations>
> = {
  ko: { days: DAY_OF_WEEK_KO },
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
