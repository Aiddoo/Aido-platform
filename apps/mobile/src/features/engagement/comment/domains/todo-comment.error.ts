import { ErrorCode, HttpStatus } from '@aido/api/errors';
import { type ApiError, isApiError } from '@src/shared/errors';

/** 이미 지워졌거나 볼 수 없는 댓글이다(TODO_0833, TODO_0831) */
export function isTodoCommentUnavailableError(error: unknown): error is ApiError {
  return (
    isApiError(error) && (error.hasCode(ErrorCode.TODO_0833) || error.hasCode(ErrorCode.TODO_0831))
  );
}

/** 너무 자주 보내 잠시 막혔다 */
export function isTodoCommentRateLimitedError(error: unknown): error is ApiError {
  return isApiError(error) && error.status === HttpStatus.TOO_MANY_REQUESTS;
}

/** 지워진 댓글과 연타 제한은 mutation onError가 경고 토스트로 알려 전역 피드백에서 뺀다 */
export function isWarnedTodoCommentError(error: unknown): boolean {
  return isTodoCommentUnavailableError(error) || isTodoCommentRateLimitedError(error);
}

/** 서버가 거절해 같은 글을 다시 보내도 같은 결과다. 4xx만 ApiError로 오고 5xx·연결 실패는 던져진 다른 오류다 */
export function isTodoCommentRejectedError(error: unknown): error is ApiError {
  return isApiError(error);
}

/** 로그에 남길 서버 응답 코드. 서버 오류가 아니면 없다 */
export function findTodoCommentErrorStatus(error: unknown) {
  return isApiError(error) ? error.status : null;
}
