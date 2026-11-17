import type { AiProviderId } from "@aido/api/vocabulary";

import type { AiSettings } from "#api/platform/config/schemas/ai.schema";
import type { OutboundPolicySpec } from "#api/platform/resilience/outbound-policy";

import { AiGenerationAlerts } from "../../application/ai-generations.alerts.js";
import {
  AiAttemptFailure,
  type AiCircuitBreakerKind,
  resolveAiFailureRule,
} from "../../application/ai-generations.errors.js";
import type { AiTaskClass } from "../../domain/ai-spend.domain-service.js";

const AI_AUTH_CIRCUIT_THRESHOLD = 3;

const isFailureForBreaker = (kind: AiCircuitBreakerKind) => (error: unknown) =>
  error instanceof AiAttemptFailure &&
  error.countsAgainstProvider &&
  resolveAiFailureRule(error.kind).breaker === kind;

/**
 * 업체별 회로. 결제 실패는 한 번에, 인증 실패와 일시 장애는 연속으로 쌓이면 연다. 열리면 운영 경보를 올린다.
 * 재시도는 AI SDK maxRetries 한 층뿐이라 여기에는 timeout·재시도를 두지 않는다.
 */
export function createAiProviderPolicy(
  provider: AiProviderId,
  breaker: AiSettings["breaker"],
): OutboundPolicySpec {
  return {
    name: `ai:${provider}`,
    breakers: [
      {
        name: "billing",
        consecutiveFailures: 1,
        halfOpenAfterMs: breaker.billingCooldownMs,
        handles: isFailureForBreaker("billing"),
        alert: AiGenerationAlerts.PROVIDER_BILLING_CIRCUIT_OPENED,
      },
      {
        // 일시적인 401·403 한 번으로 Gemini만 쓰는 사용자의 AI가 15분 멈추지 않게 연속 실패에만 연다.
        name: "auth",
        consecutiveFailures: AI_AUTH_CIRCUIT_THRESHOLD,
        halfOpenAfterMs: breaker.billingCooldownMs,
        handles: isFailureForBreaker("auth"),
        alert: AiGenerationAlerts.PROVIDER_AUTH_CIRCUIT_OPENED,
      },
      {
        name: "health",
        consecutiveFailures: breaker.healthThreshold,
        halfOpenAfterMs: breaker.healthCooldownMs,
        handles: isFailureForBreaker("health"),
        alert: AiGenerationAlerts.PROVIDER_HEALTH_CIRCUIT_OPENED,
      },
    ],
    describeFailure: (failure): Readonly<Record<string, string>> =>
      failure instanceof AiAttemptFailure ? { reason: failure.kind, task: failure.task } : {},
  };
}

/**
 * 작업 분류별 동시 생성 상한. 배경 배치가 몰려도 업체 429와 비싼 폴백으로 번지지 않게 하고,
 * 사용자 요청은 배경 작업과 따로 자리를 둔다.
 */
export const AI_TASK_CLASS_POLICIES: Readonly<Record<AiTaskClass, OutboundPolicySpec>> = {
  interactive: { name: "ai:interactive", bulkhead: { limit: 8, queue: 16 } },
  background: { name: "ai:background", bulkhead: { limit: 2, queue: 200 } },
};
