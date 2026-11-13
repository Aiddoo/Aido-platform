import { MINUTE_MS } from '@src/shared/constants/time-units';
import { z } from 'zod';

/** 오프셋이 달라도 되는 ISO 8601 문자열이라 구조 공유가 된다 */
export const instantSchema = z.iso.datetime({ offset: true }).brand<'Instant'>();
export type Instant = z.infer<typeof instantSchema>;

/** 순간으로 읽을 수 없는 문자열은 던진다. 서버·저장소 경계에서 한 번만 부른다 */
export function toInstant(value: string): Instant {
  return instantSchema.parse(value);
}

/** 서버·저장소의 선택 시각 칸을 순간으로 바꾼다. 없으면 null이다 */
export function toNullableInstant(value: string | null): Instant | null {
  return value == null ? null : toInstant(value);
}

export function fromEpochMs(ms: number): Instant {
  // 서버 toIsoString(Temporal, ms 3자리 내림)과 바이트 단위로 같은 UTC 표기다
  return toInstant(new Date(ms).toISOString());
}

/** 에포크 밀리초. 오프셋이 달라도 같은 순간이면 같은 값이다 */
export function toEpochMs(instant: Instant): number {
  // 목록 정렬이 비교마다 부르므로 Date 객체를 만들지 않고 문자열을 바로 읽는다
  return Date.parse(instant);
}

/** 앞 값에서 뒤 값을 뺀 밀리초 */
export function diffMs(instant: Instant, other: Instant): number {
  return toEpochMs(instant) - toEpochMs(other);
}

/** 끝나는 시각 자체를 지난 것으로 본다 */
export function hasInstantPassed(instant: Instant, now: Instant): boolean {
  return toEpochMs(instant) <= toEpochMs(now);
}

/** 목표 순간까지 남은 분(올림). 이미 지났으면 0분이다 */
export function getMinutesUntil(target: Instant, now: Instant): number {
  return Math.max(0, Math.ceil(diffMs(target, now) / MINUTE_MS));
}
