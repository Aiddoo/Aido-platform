import type { TimeZone } from "#api/shared/domain/time/time-zone.vo";
import { localDateOf, toZonedInstant } from "#api/shared/domain/time/zoned-time";

import type { BroadcastDelivery } from "./broadcast-delivery.vo.js";

/**
 * 수신자 한 명에게 알림을 만들 시각. null이면 지금 보낸다.
 * RECIPIENT_LOCAL_TIME은 수신자 시간대의 그 날짜·시각이고, 이미 지났으면 같은 시각의 다음 날이다.
 * 날짜가 오래전이어도 지난 날짜로는 보내지 않고 수신자의 오늘부터 다음 그 시각을 고른다.
 */
export function resolveRecipientStartAfter(params: {
  readonly delivery: BroadcastDelivery;
  readonly timeZone: TimeZone;
  readonly now: Temporal.Instant;
}): Temporal.Instant | null {
  const { delivery, timeZone, now } = params;
  const { value } = delivery;
  if (value.mode === "NOW") {
    return null;
  }

  const localToday = localDateOf(now, timeZone);
  const firstDate =
    Temporal.PlainDate.compare(value.date, localToday) < 0 ? localToday : value.date;
  const firstInstant = toZonedInstant({ date: firstDate, time: value.localTime, timeZone });
  if (Temporal.Instant.compare(firstInstant, now) > 0) {
    return firstInstant;
  }
  return toZonedInstant({ date: firstDate.add({ days: 1 }), time: value.localTime, timeZone });
}
