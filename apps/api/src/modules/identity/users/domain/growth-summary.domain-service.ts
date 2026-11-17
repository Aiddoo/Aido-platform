import {
  DEFAULT_GROWTH_COHORT_DAYS,
  GROWTH_ACTIVATION_WINDOW_HOURS,
  GROWTH_RETENTION_DAYS,
  type GrowthRetentionKey,
} from "./growth-metrics.constants.js";

export interface GrowthCohortMetric {
  readonly eligible: number;
  readonly achieved: number;
  readonly rate: number;
}

/** 가입 cohort 한 명. 현지 날짜는 그 사람의 첫 활동 시간대(없으면 설정, 그다음 UTC)로 정한 값이다 */
export interface GrowthCohortSignup {
  readonly signedUpAt: Temporal.Instant;
  readonly signupLocalDate: Temporal.PlainDate;
  readonly asOfLocalDate: Temporal.PlainDate;
  /** 가입 현지 날짜에서 GROWTH_RETENTION_DAYS만큼 뒤의 현지 날짜에 활동이 있었는지 */
  readonly activeOn: Readonly<Record<GrowthRetentionKey, boolean>>;
  /** 가입 활성화 구간에 할 일을 만들고 완료했는지 */
  readonly activated: boolean;
}

interface GrowthCohortCount {
  readonly eligible: number;
  readonly achieved: number;
}

export interface GrowthCohortTally {
  readonly signups: number;
  readonly activation: GrowthCohortCount;
  readonly retention: Readonly<Record<GrowthRetentionKey, GrowthCohortCount>>;
  /** d7 대상이면서 활성화와 d7 리텐션을 모두 달성한 사람 수 */
  readonly d7RetainedActivatedUsers: number;
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

/** 가입 시각부터 활성화로 보는 구간. 양 끝을 포함한다 */
export function activationWindowOf(signedUpAt: Temporal.Instant): {
  readonly from: Temporal.Instant;
  readonly until: Temporal.Instant;
} {
  return { from: signedUpAt, until: signedUpAt.add({ hours: GROWTH_ACTIVATION_WINDOW_HOURS }) };
}

/**
 * cohort를 센다. 활성화는 구간이 끝난 사람만 대상이다. 리텐션은 측정이 시작된 뒤 가입했고 그 현지 날짜가
 * 기준 현지 날짜보다 앞서 끝난 사람만 대상이다(측정 전에는 활동 기록이 없어 달성 여부를 알 수 없다).
 */
export function tallyGrowthCohort(params: {
  readonly signups: readonly GrowthCohortSignup[];
  readonly measurementStartedAt: Temporal.Instant | null;
  readonly asOf: Temporal.Instant;
}): GrowthCohortTally {
  const { signups, measurementStartedAt, asOf } = params;
  const activationEligible = signups.filter(
    (signup) => Temporal.Instant.compare(activationWindowOf(signup.signedUpAt).until, asOf) <= 0,
  );
  const isRetentionEligible = (signup: GrowthCohortSignup, key: GrowthRetentionKey): boolean =>
    measurementStartedAt != null &&
    Temporal.Instant.compare(signup.signedUpAt, measurementStartedAt) >= 0 &&
    Temporal.PlainDate.compare(
      signup.signupLocalDate.add({ days: GROWTH_RETENTION_DAYS[key] }),
      signup.asOfLocalDate,
    ) < 0;
  const retentionOf = (key: GrowthRetentionKey): GrowthCohortCount => {
    const eligible = signups.filter((signup) => isRetentionEligible(signup, key));
    return {
      eligible: eligible.length,
      achieved: eligible.filter((signup) => signup.activeOn[key]).length,
    };
  };

  return {
    signups: signups.length,
    activation: {
      eligible: activationEligible.length,
      achieved: activationEligible.filter((signup) => signup.activated).length,
    },
    retention: { d1: retentionOf("d1"), d7: retentionOf("d7"), d30: retentionOf("d30") },
    d7RetainedActivatedUsers: signups.filter(
      (signup) => isRetentionEligible(signup, "d7") && signup.activated && signup.activeOn.d7,
    ).length,
  };
}
