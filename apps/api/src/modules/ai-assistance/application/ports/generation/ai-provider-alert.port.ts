import type { AiProviderId } from "@aido/api/vocabulary";

import type { AiFailureKind } from "./ai-generation.errors.js";
import type { AiTaskId } from "./ai-generator.port.js";

/** 결제·인증 문제로 업체를 건너뛰기 시작한 사실. 사람이 키·크레딧을 확인해야 한다. */
export interface AiProviderBillingCircuitOpened {
  readonly provider: AiProviderId;
  readonly task: AiTaskId;
  readonly reason: Extract<AiFailureKind, "QUOTA_EXHAUSTED" | "AUTH">;
  readonly cooldownMs: number;
}

export interface AiProviderAlertPort {
  reportBillingCircuitOpened(event: AiProviderBillingCircuitOpened): void;
}

export const AI_PROVIDER_ALERT = Symbol("AI_PROVIDER_ALERT");
