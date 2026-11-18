import type { SupportedLocale } from "@aido/api/vocabulary";

/** 요청 헤더가 없을 때 쓰는 사용자의 저장된 시간대·언어. */
export interface UserLocalePreferenceReadModel {
  readonly timezone: string;
  readonly locale: SupportedLocale;
}
