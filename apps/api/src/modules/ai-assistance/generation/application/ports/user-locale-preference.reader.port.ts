import type { SupportedLocale } from "#api/shared/domain/locale";

/** 요청 헤더가 없을 때 쓰는 사용자의 저장된 시간대·언어. */
export interface UserLocalePreference {
  readonly timezone: string;
  readonly locale: SupportedLocale;
}

export abstract class UserLocalePreferenceReaderPort {
  abstract read(userId: string): Promise<UserLocalePreference>;
}
