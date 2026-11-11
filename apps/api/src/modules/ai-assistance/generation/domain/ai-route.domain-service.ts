import type { AiDataSharingConsentVersion, AiProviderId } from "@aido/api/vocabulary";
import { sumBy } from "es-toolkit";

import { resolveConsentedAiProviders } from "./ai-processor-consent.domain-service.js";

export interface AiRouteInput {
  /** 설정 AI_PROVIDER_ORDER 순서 */
  readonly order: readonly AiProviderId[];
  /** API 키가 있어 호출할 수 있는 업체 */
  readonly configured: ReadonlySet<AiProviderId>;
  readonly agreedVersion: AiDataSharingConsentVersion | null;
  /** 회로가 열려 아직 건너뛰어야 하는 업체 */
  readonly openCircuits: ReadonlySet<AiProviderId>;
}

/** 한 요청이 차례로 시도할 처리 업체. 비어 있으면 지금 보낼 수 있는 업체가 없다. */
export function planAiRoute(input: AiRouteInput): readonly AiProviderId[] {
  const consented = resolveConsentedAiProviders(input.agreedVersion);
  return input.order.filter(
    (provider) =>
      input.configured.has(provider) &&
      consented.has(provider) &&
      !input.openCircuits.has(provider),
  );
}

/**
 * 체인 제한 시간을 나눌 때 업체가 받는 몫의 비율. 기준은 어떤 순서로 모두 멈춰도 각 업체가 자기 작업의 2026-11 live eval
 * 최댓값(parse-todo·quick-plan·digest: Claude 2.3·4.9·5.0초, Gemini 1.8·4.9·6.8초, OpenAI 4.8·5.2·6.2초)의 1.2배를
 * 받는 것이다. OpenAI만 두 배면 12·24·45초 체인에서 OpenAI 6·12·22.5초, 나머지 3·6·11.25초가 되어 이를 넘는다.
 */
const PROVIDER_TIME_WEIGHTS: Readonly<Record<AiProviderId, number>> = {
  anthropic: 1,
  google: 1,
  openai: 2,
};

/** 타이머 오차로 몫을 몇 ms 덜 받은 시도까지 몫을 온전히 받은 것으로 친다. */
const FULL_SHARE_TOLERANCE = 0.9;

function sumWeights(providers: readonly AiProviderId[]): number {
  return sumBy(providers, (provider) => PROVIDER_TIME_WEIGHTS[provider]);
}

export interface AttemptTimeInput {
  readonly route: readonly AiProviderId[];
  readonly provider: AiProviderId;
  /** 뒤에 시도할 업체가 없다. 남은 시간을 모두 쓴다. */
  readonly isLast: boolean;
  readonly deadlineMs: number;
  readonly remainingMs: number;
}

export interface AttemptTime {
  readonly budgetMs: number;
  /** 몫보다 적게 받았으면 시간 초과가 그 업체 탓이 아니므로 장애 회로에 세지 않는다. */
  readonly hadFullShare: boolean;
}

/**
 * 남은 시간을 이번 업체와 아직 시도하지 않은 업체의 몫대로 나눈다. 앞 업체가 빨리 실패하면 뒤 업체 시간이 늘고,
 * 앞 업체가 몫을 다 써도 뒤 업체는 자기 몫을 그대로 받는다.
 */
export function resolveAttemptTime(input: AttemptTimeInput): AttemptTime {
  const { route, provider, isLast, deadlineMs, remainingMs } = input;
  const weight = PROVIDER_TIME_WEIGHTS[provider];
  const pending = isLast ? [provider] : route.slice(route.indexOf(provider));
  const budgetMs = Math.floor((remainingMs * weight) / sumWeights(pending));
  const fullShareMs = (deadlineMs * weight) / sumWeights(route);
  return { budgetMs, hadFullShare: budgetMs >= fullShareMs * FULL_SHARE_TOLERANCE };
}
