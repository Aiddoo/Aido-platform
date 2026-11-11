import {
  describeVendorFailure,
  isServerFailureOutcome,
} from "#api/platform/http/request-vendor-json";
import {
  isTransportFailure,
  type OutboundPolicySpec,
} from "#api/platform/resilience/outbound-policy";

/**
 * RevenueCat REST v2 구독 상태 읽기. 재시도는 pg-boss 한 층이다. 공급자 전체 장애(시간 초과·네트워크·5xx)가
 * 이어지면 회로를 열어 대조 잡이 매번 시간 초과를 기다리지 않게 한다. 시도별 timeout은 http-client가 건다.
 */
export const REVENUECAT_API_POLICY: OutboundPolicySpec = {
  name: "revenuecat",
  bulkhead: { limit: 2, queue: 50 },
  breakers: [
    {
      name: "health",
      consecutiveFailures: 5,
      halfOpenAfterMs: 60_000,
      handles: isTransportFailure,
      handlesResult: isServerFailureOutcome,
    },
  ],
  describeFailure: describeVendorFailure,
};
