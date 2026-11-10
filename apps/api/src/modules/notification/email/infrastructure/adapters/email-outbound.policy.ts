import { describeVendorFailure } from "#api/platform/http/request-vendor-json";
import {
  isTransportFailure,
  type OutboundPolicySpec,
} from "#api/platform/resilience/outbound-policy";
import { TIME_UNIT } from "#api/shared/domain/date/constants/date.constant";

import { EmailAlerts } from "../../application/email.alerts.js";

export const EMAIL_SEND_TIMEOUT_MS = 10_000;

/** 공급자 전체 장애(시간 초과·연결 실패·5xx)로 센 결과. 429·검증 거절은 그 요청의 문제다. */
function isUnavailableOutcome(result: unknown): boolean {
  return (
    typeof result === "object" &&
    result != null &&
    "status" in result &&
    result.status === "failed" &&
    "reason" in result &&
    result.reason === "unavailable"
  );
}

/**
 * 메일 공급자 호출 보호. 재시도는 pg-boss 한 층에만 두므로 여기에는 없다. 시도별 제한 시간은
 * Aggressive timeout이 signal로 전송을 끊고, 끊긴 요청이 공급자에서 이어질 수 있어 멱등 키를 쓴다.
 * Resend의 초당 10요청 제한은 bulkhead 2와 worker 동시성 2로 맞춘다.
 */
export const EMAIL_PROVIDER_POLICY: OutboundPolicySpec = {
  // 회로 경보·로그가 이 이름으로 이어지므로 공급자를 바꾸기 전까지 유지한다
  name: "resend",
  timeoutMs: EMAIL_SEND_TIMEOUT_MS,
  bulkhead: { limit: 2, queue: 100 },
  breakers: [
    {
      name: "health",
      consecutiveFailures: 5,
      halfOpenAfterMs: TIME_UNIT.MS_PER_MINUTE,
      handles: isTransportFailure,
      handlesResult: isUnavailableOutcome,
      alert: EmailAlerts.CIRCUIT_OPEN,
    },
  ],
  describeFailure: (failure) =>
    isUnavailableOutcome(failure) ? { reason: "unavailable" } : describeVendorFailure(failure),
};
