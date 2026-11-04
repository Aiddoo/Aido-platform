import { ErrorCode } from '@aido/api/errors';
import { isApiError, isConnectivityError, isInfraError } from '@src/shared/errors';

/** 계획을 만들거나 저장하지 못한 원인. 원인마다 문구와 다음 행동이 다르다 */
export type VoicePlanFailureCause =
  | 'network'
  | 'limit'
  | 'too-long'
  | 'in-progress'
  | 'rejected'
  | 'key-expired'
  | 'key-conflict'
  | 'source-memo-missing'
  | 'ai-unavailable'
  | 'unknown';

export function isPlanKeyExpiredError(error: unknown) {
  return isApiError(error) && error.hasCode(ErrorCode.AI_1317);
}

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

export function getVoicePlanFailureCause(error: unknown): VoicePlanFailureCause {
  if (isConnectivityError(error)) {
    return 'network';
  }
  if (!isApiError(error)) {
    return isInfraError(error) ? 'ai-unavailable' : 'unknown';
  }
  if (error.hasCode(ErrorCode.AI_1303) || error.hasCode(ErrorCode.AI_1313)) {
    return 'limit';
  }
  if (error.hasCode(ErrorCode.AI_1312)) {
    return 'too-long';
  }
  if (error.hasCode(ErrorCode.AI_1314)) {
    return 'in-progress';
  }
  if (error.hasCode(ErrorCode.AI_1315)) {
    return 'rejected';
  }
  if (isPlanKeyExpiredError(error)) {
    return 'key-expired';
  }
  if (isPlanKeyConflictError(error)) {
    return 'key-conflict';
  }
  if (isSourceMemoMissingError(error)) {
    return 'source-memo-missing';
  }
  if (
    error.hasCode(ErrorCode.AI_1301) ||
    error.hasCode(ErrorCode.AI_1302) ||
    error.hasCode(ErrorCode.AI_1310)
  ) {
    return 'ai-unavailable';
  }
  return 'unknown';
}
