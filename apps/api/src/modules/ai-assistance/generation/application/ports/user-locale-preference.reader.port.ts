import type { SupportedLocale } from "#api/shared/domain/locale";

/** 요청 헤더가 없을 때 쓰는 사용자의 저장된 시간대·언어. */
export interface UserLocalePreference {
  readonly timezone: string;
  readonly locale: SupportedLocale;
}

export abstract class UserLocalePreferenceReaderPort {
  abstract read(userId: string): Promise<UserLocalePreference>;
}

/** 옛 토큰. voice가 클래스 토큰으로 옮기면 지운다(같은 인스턴스 별칭으로 바인딩) */
export const USER_LOCALE_PREFERENCE_READER = Symbol("USER_LOCALE_PREFERENCE_READER");
