const GROWTH_METRIC_KEYS = [
  "dau",
  "wau",
  "mau",
  "stickiness",
  "activation24h",
  "d1",
  "d7",
  "d30",
] as const;

type GrowthMetricKey = (typeof GROWTH_METRIC_KEYS)[number];

interface GrowthMetricDefinition {
  readonly key: GrowthMetricKey;
  /** 운영 문서(notifications.md 지표 정의)와 같은 문장이다 */
  readonly definition: string;
}

/** 지표 정의의 한 곳. "활성"은 로그인한 사용자의 앱 요청이 있는 사용자 현지 날짜다(UserActivityDay.localDate). */
export const GROWTH_METRIC_DEFINITIONS = {
  dau: { key: "dau", definition: "종료 현지 날짜에 활동이 있는 순 사용자 수" },
  wau: { key: "wau", definition: "종료 현지 날짜를 포함한 최근 7일에 활동이 있는 순 사용자 수" },
  mau: { key: "mau", definition: "종료 현지 날짜를 포함한 최근 30일에 활동이 있는 순 사용자 수" },
  stickiness: { key: "stickiness", definition: "DAU / MAU (%, 소수 둘째 자리, MAU가 0이면 0)" },
  activation24h: {
    key: "activation24h",
    definition: "가입 24시간 안에 할 일을 만들고 완료한 가입 cohort 비율",
  },
  d1: { key: "d1", definition: "가입 다음 현지 날짜에 활동이 있는 가입 cohort 비율" },
  d7: { key: "d7", definition: "가입 후 7번째 현지 날짜에 활동이 있는 가입 cohort 비율" },
  d30: { key: "d30", definition: "가입 후 30번째 현지 날짜에 활동이 있는 가입 cohort 비율" },
} satisfies Record<GrowthMetricKey, GrowthMetricDefinition>;

/** 범위를 주지 않으면 어제까지 마지막 30개 현지 날짜를 cohort로 본다 */
export const DEFAULT_GROWTH_COHORT_DAYS = 30;
