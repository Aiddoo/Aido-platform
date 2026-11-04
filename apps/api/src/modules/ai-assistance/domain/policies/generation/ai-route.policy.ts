import type { AiDataSharingConsentVersion, AiProviderId } from "@aido/api/vocabulary";

import { resolveConsentedAiProviders } from "./ai-processor-consent.policy.js";

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
