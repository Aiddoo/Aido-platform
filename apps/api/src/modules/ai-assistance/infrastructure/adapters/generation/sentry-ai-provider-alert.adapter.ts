import { Injectable } from "@nestjs/common";
import * as Sentry from "@sentry/nestjs";

import { SENTRY_EXTRA, SENTRY_FEATURE, SENTRY_TAG } from "#api/platform/observability/sentry-keys";

import type {
  AiProviderAlertPort,
  AiProviderBillingCircuitOpened,
} from "../../../application/ports/generation/ai-provider-alert.port.js";

const PROVIDER_NAMES = { anthropic: "Claude", google: "Gemini", openai: "OpenAI" } as const;

/**
 * 결제·인증 실패로 업체를 건너뛰기 시작하면 사람이 크레딧·키를 확인해야 하므로 Sentry 이슈로 남긴다.
 * 같은 업체·사유는 같은 메시지라 한 이슈로 모인다.
 */
@Injectable()
export class SentryAiProviderAlertAdapter implements AiProviderAlertPort {
  reportBillingCircuitOpened(event: AiProviderBillingCircuitOpened): void {
    const reason = event.reason === "QUOTA_EXHAUSTED" ? "크레딧 소진" : "API 키 인증 실패";
    Sentry.withScope((scope) => {
      scope.setTag(SENTRY_TAG.FEATURE, SENTRY_FEATURE.AI_GENERATION);
      scope.setTag(SENTRY_TAG.AI_PROVIDER, event.provider);
      scope.setTag(SENTRY_TAG.AI_TASK, event.task);
      scope.setExtra(SENTRY_EXTRA.AI_FAILURE_KIND, event.reason);
      scope.setExtra(SENTRY_EXTRA.AI_COOLDOWN_MS, event.cooldownMs);
      Sentry.captureMessage(
        `${PROVIDER_NAMES[event.provider]} ${reason}, 다음 순서 AI 업체로 전환`,
        "error",
      );
    });
  }
}
