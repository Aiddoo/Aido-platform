import dayjs from "dayjs";

import type { SupportedLocale } from "#api/shared/domain/locale";

export interface PromptCategory {
  readonly id: number;
  readonly name: string;
}

const WEEKDAY_LABELS: Readonly<Record<SupportedLocale, readonly string[]>> = {
  ko: ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"],
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
};

/** 표현을 고를 기준 시각. 연도를 포함한 사용자 로컬 시각과 요일을 준다(계산은 서버가 한다). */
export function buildScheduleContext(input: {
  readonly now: Date;
  readonly timezone: string;
  readonly locale: SupportedLocale;
}) {
  const local = dayjs(input.now).tz(input.timezone);
  return {
    now: local.format("YYYY-MM-DDTHH:mm"),
    weekday: WEEKDAY_LABELS[input.locale][local.day()],
    timezone: input.timezone,
  };
}

export function toPromptCategories(categories: readonly PromptCategory[]) {
  return categories.map(({ id, name }) => ({ id, name }));
}
