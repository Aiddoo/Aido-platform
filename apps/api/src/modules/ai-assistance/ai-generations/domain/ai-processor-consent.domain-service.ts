import {
  AI_DATA_SHARING_CONSENT_PROVIDERS,
  type AiDataSharingConsentVersion,
  type AiProviderId,
} from "@aido/api/vocabulary";

/** 동의 화면이 없던 1.13 미만 앱이 받은 안내(Google Gemini)와 같은 범위 */
const PRE_CONSENT_VERSION = "2026-10-26" satisfies AiDataSharingConsentVersion;

/**
 * 동의한 안내 버전이 허용한 처리 업체.
 * 동의 버전이 없으면(동의 화면이 없던 1.13 미만 앱의 요청) 그때 안내한 Google만 쓴다.
 */
export function resolveConsentedAiProviders(
  agreedVersion: AiDataSharingConsentVersion | null,
): ReadonlySet<AiProviderId> {
  return new Set<AiProviderId>(
    AI_DATA_SHARING_CONSENT_PROVIDERS[agreedVersion ?? PRE_CONSENT_VERSION],
  );
}
