/**
 * Todo 도메인 클라이언트 에러
 *
 * - 서버 에러(ApiError)와 분리
 * - reason으로 에러 종류 구분 → UI에서 분기 처리
 */
export class TodoClientError extends Error {
  constructor(
    readonly reason: 'validation' | 'unknown',
    message: string,
  ) {
    super(message);
    this.name = 'TodoClientError';
  }

  /** Repository: safeParse 실패 */
  static validation(): TodoClientError {
    return new TodoClientError('validation', '잘못된 응답 형식이에요');
  }

  /** 예상치 못한 에러 */
  static unknown(message?: string): TodoClientError {
    return new TodoClientError('unknown', message ?? '알 수 없는 오류가 발생했어요');
  }
}
