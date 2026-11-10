import {
  AI_DATA_SHARING_CONSENT,
  AI_DATA_SHARING_CONSENT_VERSIONS,
  isSemanticVersionAtLeast,
} from "@aido/api/vocabulary";

import type { AiDataSharingConsent } from "#api/modules/identity/identity-settings.public";

// 어느 안내 버전에 동의했든 그 버전이 허용한 업체로는 보낸다. 업체 범위는 resolveConsentedAiProviders가 정한다
const ANY_CONSENT_VERSION = AI_DATA_SHARING_CONSENT_VERSIONS[0];

/**
 * 사용자 데이터를 AI 공급자로 보내도 되는지. HTTP guard·예약 작업이 같은 판정을 쓴다.
 *
 * 동의 화면이 있는 1.13.0 이상 앱을 쓰면 동의 Entity가 now에 AI 처리를 허용할 때만 보낸다.
 * 그보다 오래된 앱은 동의를 받을 화면이 없으므로 거부·철회(DECLINED)하지 않았다면 기존처럼 보낸다.
 *
 * - 사용자가 요청한 AI 정리: 요청 헤더의 앱 버전
 * - 예약 작업(리포트 요약·반복 제안): 푸시 기기와 인증 요청에 남은 버전 중 가장 높은 버전. 알 수 없으면 오래된 앱으로 본다
 */
export function canShareWithAi(input: {
  readonly consent: AiDataSharingConsent;
  readonly appVersion: string | null | undefined;
  readonly now: Temporal.Instant;
}): boolean {
  const { consent, appVersion, now } = input;
  if (isSemanticVersionAtLeast(appVersion, AI_DATA_SHARING_CONSENT.MIN_APP_VERSION)) {
    return consent.allowsAiProcessingAt(now, ANY_CONSENT_VERSION);
  }
  return consent.status().decision !== "DECLINED";
}
