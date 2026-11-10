export interface MinutesToSweepParams {
  readonly lastCompletedAt: Temporal.Instant | null;
  readonly now: Temporal.Instant;
  readonly maxCatchUpMinutes: number;
}

/** 마지막으로 끝낸 분 다음부터 지금 분까지(분 시작 시각, 오래된 순). 늦은 쪽은 가장 최근 N분만 남긴다. */
export function minutesToSweep({
  lastCompletedAt,
  now,
  maxCatchUpMinutes,
}: MinutesToSweepParams): Temporal.Instant[] {
  const current = floorToMinute(now);
  if (lastCompletedAt == null) {
    return [current];
  }
  const last = floorToMinute(lastCompletedAt);
  // 시계가 거꾸로 가면 기록을 믿을 수 없어 지금 분만 처리한다
  if (Temporal.Instant.compare(last, current) > 0) {
    return [current];
  }
  const missed = last.until(current, { largestUnit: "minutes" }).minutes;
  const count = Math.min(missed, maxCatchUpMinutes);
  return Array.from({ length: count }, (_, index) =>
    current.subtract({ minutes: count - 1 - index }),
  );
}

function floorToMinute(instant: Temporal.Instant): Temporal.Instant {
  return instant.round({ smallestUnit: "minute", roundingMode: "floor" });
}
