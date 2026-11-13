import { ErrorCode } from '@aido/api/errors';
import { isApiError } from '@src/shared/errors';

/** 미리보기 뒤에 다른 기기에서 카테고리나 할 일이 바뀌어 서버가 지금 상태와 맞지 않는 삭제를 거절했다 */
export function isDeletionPreviewOutdatedError(error: unknown) {
  return (
    isApiError(error) &&
    (error.hasCode(ErrorCode.TODO_CATEGORY_0854) ||
      error.hasCode(ErrorCode.TODO_CATEGORY_0855) ||
      error.hasCode(ErrorCode.TODO_CATEGORY_0856))
  );
}
