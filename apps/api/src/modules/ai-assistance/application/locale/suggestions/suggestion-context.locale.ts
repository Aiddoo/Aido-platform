import { DAY_OF_WEEK_KO, type DayOfWeek } from "@aido/api/vocabulary";

import type { SupportedLocale } from "#api/shared/domain/locale";

interface SuggestionContextTranslations {
  readonly days: Readonly<Record<DayOfWeek, string>>;
  readonly none: string;
  readonly noStreak: string;
  readonly morning: string;
  readonly afternoon: string;
  readonly clear: string;
  readonly precipitation: Readonly<Record<string, string>>;
  readonly missingRoutine: (title: string, day: DayOfWeek) => string;
  readonly streak: (current: number, longest: number) => string;
  readonly reportInsight: (rate: number, streak: number) => string;
  readonly weather: (description: string, min: number, max: number, probability?: number) => string;
  readonly currentDate: (date: string, day: DayOfWeek, month: number, dayOfMonth: number) => string;
}
const DAYS_EN: Readonly<Record<DayOfWeek, string>> = {
  MON: "Monday",
  TUE: "Tuesday",
  WED: "Wednesday",
  THU: "Thursday",
  FRI: "Friday",
  SAT: "Saturday",
  SUN: "Sunday",
};
export const suggestionContextTranslations: Readonly<
  Record<SupportedLocale, SuggestionContextTranslations>
> = {
  ko: {
    days: DAY_OF_WEEK_KO,
    none: "없음",
    noStreak: "정보 없음",
    morning: "오전(~12시)",
    afternoon: "오후(12시~)",
    clear: "맑음",
    precipitation: { RAIN: "비", SNOW: "눈", RAIN_SNOW: "비/눈", SHOWER: "소나기" },
    missingRoutine: (title, day) =>
      `${title}(매주 ${DAY_OF_WEEK_KO[day]}요일에 했는데 이번 주 없음)`,
    streak: (current, longest) => `현재 ${current}일 연속, 최장 ${longest}일`,
    reportInsight: (rate, streak) => `최근 주간 달성률: ${rate}%, 스트릭: ${streak}일`,
    weather: (description, min, max, probability) =>
      probability === undefined
        ? `${description}, ${min}~${max}°C`
        : `${description}(강수확률 ${probability}%), ${min}~${max}°C`,
    currentDate: (date, day, month, dayOfMonth) =>
      `${date} (${DAY_OF_WEEK_KO[day]}요일, ${month}월 ${dayOfMonth <= 10 ? "초" : dayOfMonth <= 20 ? "중순" : "말"})`,
  },
  en: {
    days: DAYS_EN,
    none: "None",
    noStreak: "No streak data",
    morning: "Morning (before 12:00)",
    afternoon: "Afternoon (12:00 onward)",
    clear: "Clear",
    precipitation: { RAIN: "Rain", SNOW: "Snow", RAIN_SNOW: "Rain/snow", SHOWER: "Showers" },
    missingRoutine: (title, day) => `${title} (usually every ${DAYS_EN[day]}; missing this week)`,
    streak: (current, longest) => `Current streak: ${current} days; longest: ${longest} days`,
    reportInsight: (rate, streak) => `Latest weekly completion: ${rate}%; streak: ${streak} days`,
    weather: (description, min, max, probability) =>
      probability === undefined
        ? `${description}, ${min}–${max}°C`
        : `${description} (${probability}% precipitation probability), ${min}–${max}°C`,
    currentDate: (date, day, month, dayOfMonth) =>
      `${date} (${DAYS_EN[day]}, ${dayOfMonth <= 10 ? "early" : dayOfMonth <= 20 ? "mid" : "late"} month ${month})`,
  },
};
