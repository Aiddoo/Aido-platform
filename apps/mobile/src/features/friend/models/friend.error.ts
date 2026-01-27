/**
 * Friend 도메인 클라이언트 에러
 *
 * - 서버 에러(ApiError)와 분리
 * - reason으로 에러 종류 구분 → UI에서 분기 처리
 */
export class FriendClientError extends Error {
  constructor(
    readonly reason: 'validation' | 'invalidTag' | 'unknown',
    message: string,
  ) {
    super(message);
    this.name = 'FriendClientError';
  }

  /** Repository: safeParse 실패 */
  static validation(): FriendClientError {
    return new FriendClientError('validation', '잘못된 응답 형식이에요');
  }

  /** Service: 태그 형식 오류 */
  static invalidTag(): FriendClientError {
    return new FriendClientError('invalidTag', '올바른 태그 형식이 아니에요');
  }
}
