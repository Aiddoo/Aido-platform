import { ErrorCode } from '@aido/api/errors';
import { isApiError, isConnectivityError, ServerError } from '@src/shared/errors';

export type VoicePlanFailureCause =
  | 'network'
  | 'consent-required'
  | 'limit'
  | 'too-long'
  | 'in-progress'
  | 'rejected'
  | 'key-conflict'
  | 'source-memo-missing'
  | 'memo-limit'
  | 'ai-unavailable'
  | 'unknown';

/** 같은 키로 다른 내용을 보냈다. 내용을 고쳐 다시 보낼 때는 새 키를 만든다 */
export function isPlanKeyConflictError(error: unknown) {
  return isApiError(error) && error.hasCode(ErrorCode.AI_1318);
}

/** 메모에서 만든 계획을 저장하는데 원본 메모가 이미 없다. 저장되지 않았고 초안도 의미가 없다 */
export function isSourceMemoMissingError(error: unknown) {
  return isApiError(error) && error.hasCode(ErrorCode.MEMO_2001);
}

/** 아직 처리 중이다. 같은 키로 잠시 뒤 다시 물으면 처음 요청의 결과를 받는다 */
export function isPlanInProgressError(error: unknown) {
  return isApiError(error) && error.hasCode(ErrorCode.AI_1314);
}

/** AI 업체가 모두 응답하지 못했다(503). 5xx라 ApiError가 아니라 서버 코드를 실은 ServerError로 온다 */
function isAiUnavailableServerError(error: unknown) {
  return error instanceof ServerError && error.serverCode === ErrorCode.AI_1301;
}

export function getVoicePlanFailureCause(error: unknown): VoicePlanFailureCause {
  if (isConnectivityError(error)) {
    return 'network';
  }
  if (isAiUnavailableServerError(error)) {
    return 'ai-unavailable';
  }
  // 그 밖의 5xx(DB 과부하 등)와 계약과 다른 응답은 AI 탓으로 단정하지 않는다
  if (!isApiError(error)) {
    return 'unknown';
  }
  if (error.hasCode(ErrorCode.AI_1311)) {
    return 'consent-required';
  }
  if (error.hasCode(ErrorCode.AI_1303) || error.hasCode(ErrorCode.AI_1313)) {
    return 'limit';
  }
  if (error.hasCode(ErrorCode.AI_1312)) {
    return 'too-long';
  }
  if (isPlanInProgressError(error)) {
    return 'in-progress';
  }
  if (error.hasCode(ErrorCode.AI_1315)) {
    return 'rejected';
  }
  if (isPlanKeyConflictError(error)) {
    return 'key-conflict';
  }
  if (isSourceMemoMissingError(error)) {
    return 'source-memo-missing';
  }
  if (error.hasCode(ErrorCode.MEMO_2003)) {
    return 'memo-limit';
  }
  if (error.hasCode(ErrorCode.AI_1302) || error.hasCode(ErrorCode.AI_1310)) {
    return 'ai-unavailable';
  }
  return 'unknown';
}

/** 같은 글자를 다시 보내도 소용없는 실패인지. 너무 긴 글은 서버가 다시 받아 주지 않는다 */
export function canRetryPlanFailure(cause: VoicePlanFailureCause) {
  return cause !== 'too-long';
}
