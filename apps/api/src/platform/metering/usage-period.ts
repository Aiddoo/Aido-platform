import { toDateString, toYearMonthString } from "#api/shared/domain/date/utils/format";

/** 외부 공급자 한도·청구는 UTC 기준이라 사용량 기간도 UTC 달력으로 나눈다. */
export const usagePeriod = {
  day: (at: Date): string => toDateString(at),
  month: (at: Date): string => toYearMonthString(at),
} as const;

/** 누적값이 이번 증가로 처음 기준선에 닿았는지. 원자적 누적값이라 동시 요청 중 하나만 true다. */
export function crossedThresholds(
  total: number,
  amount: number,
  thresholds: readonly number[],
): number[] {
  return thresholds.filter((threshold) => total >= threshold && total - amount < threshold);
}
