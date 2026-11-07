import { ErrorCode } from '@aido/api/errors';
import { type ApiError, isApiError } from '@src/shared/errors';

const TOO_MANY_REQUESTS_STATUS = 429;

/** 이미 지워졌거나 볼 수 없는 댓글이다(TODO_0833, TODO_0831) */
export function isTodoCommentUnavailable(error: unknown): error is ApiError {
  return (
    isApiError(error) && (error.hasCode(ErrorCode.TODO_0833) || error.hasCode(ErrorCode.TODO_0831))
  );
}

/** 너무 자주 보내 잠시 막혔다 */
export function isTodoCommentRateLimited(error: unknown): error is ApiError {
  return isApiError(error) && error.status === TOO_MANY_REQUESTS_STATUS;
}

/** 같은 글을 다시 보내도 같은 결과인 4xx다 */
export function isTodoCommentRejected(error: unknown): error is ApiError {
  return isApiError(error) && error.status >= 400 && error.status < 500;
}

/** 로그에 남길 서버 응답 코드. 서버 오류가 아니면 없다 */
export function getTodoCommentErrorStatus(error: unknown) {
  return isApiError(error) ? error.status : null;
}
