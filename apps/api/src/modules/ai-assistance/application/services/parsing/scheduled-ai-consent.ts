import { canShareWithAi } from "../../../domain/policies/parsing/ai-data-sharing-consent.policy.js";
import type { AiDataSharingConsentDecisionReaderPort } from "../../ports/parsing/ai-data-sharing-consent.reader.port.js";
import type { AiClientAppVersionReaderPort } from "../../ports/parsing/client-app-version.reader.port.js";

export interface ScheduledAiConsentReaders {
  readonly aiDataSharingConsent: Pick<
    AiDataSharingConsentDecisionReaderPort,
    "findAiDataSharingDecision"
  >;
  readonly clientAppVersion: Pick<AiClientAppVersionReaderPort, "findLatestAppVersion">;
}

/**
 * 예약 작업(리포트 요약·반복 제안)이 사용자 데이터를 AI로 보내도 되는지.
 * 요청 헤더가 없으므로 사용자가 쓰는 기기 중 가장 높은 앱 버전으로 동의가 필요한지 정한다.
 */
export async function canRunScheduledAi(
  readers: ScheduledAiConsentReaders,
  userId: string,
): Promise<boolean> {
  const [decision, appVersion] = await Promise.all([
    readers.aiDataSharingConsent.findAiDataSharingDecision(userId),
    readers.clientAppVersion.findLatestAppVersion(userId),
  ]);
  return canShareWithAi(decision, appVersion);
}
