import { ErrorCode } from '@aido/api/errors';
import { isApiError } from '@src/shared/errors';

const NOT_FOUND_STATUS = 404;

/** 미리보기 경로가 없는 옛 서버(1.15.0까지)도 404로 답한다. 카테고리가 없을 때의 404(TODO_CATEGORY_0851)와는 코드로 가른다 */
export function isDeletionPreviewUnsupportedError(error: unknown) {
  return (
    isApiError(error) &&
    error.status === NOT_FOUND_STATUS &&
    !error.hasCode(ErrorCode.TODO_CATEGORY_0851)
  );
}

/** 미리보기 뒤에 다른 기기에서 카테고리나 할 일이 바뀌어 서버가 지금 상태와 맞지 않는 삭제를 거절했다 */
export function isDeletionPreviewOutdatedError(error: unknown) {
  return (
    isApiError(error) &&
    (error.hasCode(ErrorCode.TODO_CATEGORY_0854) ||
      error.hasCode(ErrorCode.TODO_CATEGORY_0855) ||
      error.hasCode(ErrorCode.TODO_CATEGORY_0856))
  );
}
