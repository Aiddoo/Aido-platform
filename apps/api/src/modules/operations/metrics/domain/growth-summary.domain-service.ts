import { DEFAULT_GROWTH_COHORT_DAYS } from "./growth-metrics.constants.js";

export interface GrowthCohortMetric {
  readonly eligible: number;
  readonly achieved: number;
  readonly rate: number;
}

const RATE_SCALE = 10_000;

// 소수 둘째 자리까지 반올림한 %. 대상이 없으면 0이다
function toPercent(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : Math.round((numerator / denominator) * RATE_SCALE) / 100;
}

export function toCohortMetric(eligible: number, achieved: number): GrowthCohortMetric {
  return { eligible, achieved, rate: toPercent(achieved, eligible) };
}

export function calculateStickiness(params: {
  readonly dau: number;
  readonly mau: number;
}): number {
  return toPercent(params.dau, params.mau);
}

/** 측정이 시작되기 전이거나 대상 cohort가 없으면 리텐션을 판단하지 않는다(null) */
export function toRetentionMetric(params: {
  readonly hasMeasurement: boolean;
  readonly eligible: number;
  readonly achieved: number;
}): GrowthCohortMetric | null {
  const { hasMeasurement, eligible, achieved } = params;
  return hasMeasurement && eligible > 0 ? toCohortMetric(eligible, achieved) : null;
}

/** 기준 시각 기준 어제까지 마지막 30개 UTC 날짜를 기본 cohort 범위로 한다 */
export function defaultCohortRange(asOf: Temporal.Instant): {
  readonly cohortFrom: Temporal.PlainDate;
  readonly cohortTo: Temporal.PlainDate;
} {
  const cohortTo = asOf.toZonedDateTimeISO("UTC").toPlainDate().subtract({ days: 1 });
  return {
    cohortFrom: cohortTo.subtract({ days: DEFAULT_GROWTH_COHORT_DAYS - 1 }),
    cohortTo,
  };
}
