import type { SupportedLocale } from "@aido/api/vocabulary";

import type { TimeZone } from "#api/shared/domain/time/time-zone.vo";

/** 수신자의 문구 언어와 현지 시각 계산에 쓰는 시간대. 저장값이 없으면 발송 판단과 같은 폴백이다. */
export interface BroadcastRecipient {
  readonly locale: SupportedLocale;
  readonly timeZone: TimeZone;
}
