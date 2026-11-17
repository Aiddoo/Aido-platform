import type { RecipientLocaleOf } from "../../../shared/domain/recipient-locale.domain-service.js";

export abstract class SchedulerPreferenceReaderPort {
  /** 저장된 시간대 중 런타임이 아는 것만, 캐시를 거쳐 읽는다. */
  abstract findActiveTimezones(): Promise<string[]>;
  /** 사용자별 수신자 언어. 설정이 없는 사용자도 resolveRecipientLocale 규칙(저장값 없으면 ko)으로 정한다. */
  abstract findUserLocales(userIds: string[]): Promise<RecipientLocaleOf>;
}
