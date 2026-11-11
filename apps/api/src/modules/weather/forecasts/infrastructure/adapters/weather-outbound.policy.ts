import {
  describeVendorFailure,
  isServerFailureOutcome,
} from "#api/platform/http/request-vendor-json";
import {
  isTransportFailure,
  type OutboundBreakerSpec,
  type OutboundPolicySpec,
} from "#api/platform/resilience/outbound-policy";

const MINUTE_MS = 60_000;

/** 공급자 전체 장애(시간 초과·네트워크·5xx)만 센다. 4xx·응답 형식 오류는 그 요청의 문제다. */
const createHealthBreaker = (consecutiveFailures: number): OutboundBreakerSpec => ({
  name: "health",
  consecutiveFailures,
  halfOpenAfterMs: MINUTE_MS,
  handles: isTransportFailure,
  handlesResult: isServerFailureOutcome,
});

/** 재시도는 두지 않는다(요청 경로라 실패하면 캐시 폴백으로 넘긴다). 시도별 timeout은 http-client가 건다. */
const createVendorPolicy = (name: string, consecutiveFailures: number): OutboundPolicySpec => ({
  name,
  bulkhead: { limit: 4, queue: 100 },
  breakers: [createHealthBreaker(consecutiveFailures)],
  describeFailure: describeVendorFailure,
});

/**
 * WeatherKit 리포트·가용성·표기. 여러 칸이 연달아 실패하면 칸별 차단만으로는 알림 순회가
 * 칸 수 × 시간 초과만큼 늘어나므로 세 번에 연다.
 */
export const WEATHERKIT_POLICY = createVendorPolicy("weatherkit", 3);
export const KMA_FORECAST_POLICY = createVendorPolicy("kma-forecast", 5);
export const KMA_LIFESTYLE_POLICY = createVendorPolicy("kma-lifestyle", 5);
export const AIRKOREA_POLICY = createVendorPolicy("airkorea", 5);
export const KASI_POLICY = createVendorPolicy("kasi", 5);

/** WeatherKit 무료 월 50만 호출의 60%·80%에서 경보를 올린다. */
export const WEATHERKIT_MONTHLY_CALL_ALERTS = [300_000, 400_000] as const;
