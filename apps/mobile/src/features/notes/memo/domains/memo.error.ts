import { ErrorCode } from '@aido/api/errors';
import { isLimitedFeatureError } from '@src/features/billing/subscription/domains/entitlement.error';
import { isAiDataSharingConsentRequiredError } from '@src/features/identity/consent/domains/consent.error';
import { isApiError } from '@src/shared/errors';

/** 지워졌거나 볼 수 없는 메모를 열었을 때(서버는 둘 다 MEMO_2001). 다시 시도해도 소용없다 */
export function isMemoUnavailableError(error: unknown) {
  return isApiError(error) && error.hasCode(ErrorCode.MEMO_2001);
}

/** AI 정리 거절 중 기능이 직접 보이는 것. 동의 없음은 요청한 화면이 동의를 묻고, 한도는 한도 게이트가 안내 시트로 보인다 */
export function isMemoParseRejectionHandledByFeature(error: unknown) {
  return isAiDataSharingConsentRequiredError(error) || isLimitedFeatureError(error);
}
