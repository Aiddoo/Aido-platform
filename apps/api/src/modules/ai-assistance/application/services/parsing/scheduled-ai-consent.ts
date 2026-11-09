import type { AiDataSharingConsentVersion } from "@aido/api/vocabulary";

import { canShareWithAi } from "../../../domain/policies/parsing/ai-data-sharing-consent.policy.js";
import type { AiDataSharingConsentDecisionReaderPort } from "../../ports/parsing/ai-data-sharing-consent.reader.port.js";
import type { AiClientAppVersionReaderPort } from "../../ports/parsing/client-app-version.reader.port.js";

export interface ScheduledAiConsentReaders {
  readonly aiDataSharingConsent: Pick<
    AiDataSharingConsentDecisionReaderPort,
    "findAiDataSharingConsent"
  >;
  readonly clientAppVersion: Pick<AiClientAppVersionReaderPort, "findLatestAppVersion">;
}

/** 예약 작업이 AI로 보내도 되는지와, 보낼 때 처리 업체 범위를 정하는 동의 버전 */
export interface ScheduledAiConsent {
  readonly allowed: boolean;
  readonly agreedVersion: AiDataSharingConsentVersion | null;
}

/**
 * 예약 작업(리포트 요약·반복 제안)이 사용자 데이터를 AI로 보내도 되는지.
 * 요청 헤더가 없으므로 푸시 기기·인증 요청에 남은 가장 높은 앱 버전으로 동의가 필요한지 정한다.
 */
export async function findScheduledAiConsent(
  readers: ScheduledAiConsentReaders,
  userId: string,
): Promise<ScheduledAiConsent> {
  const [consent, appVersion] = await Promise.all([
    readers.aiDataSharingConsent.findAiDataSharingConsent(userId),
    readers.clientAppVersion.findLatestAppVersion(userId),
  ]);
  return {
    allowed: canShareWithAi(consent.decision, appVersion),
    agreedVersion: consent.agreedVersion,
  };
}
