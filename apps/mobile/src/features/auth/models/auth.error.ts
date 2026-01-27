/**
 * 클라이언트 자체 에러
 * - 서버 호출 이전에 발생하는 에러
 * - cancelled: 사용자가 로그인 창 닫음
 * - network: 네트워크 연결 없음
 * - validation: 응답 파싱 실패
 * - unknown: 예상치 못한 에러
 */
export class AuthClientError extends Error {
  constructor(
    readonly reason: 'cancelled' | 'network' | 'validation' | 'unknown',
    message: string,
  ) {
    super(message);
    this.name = 'AuthClientError';
  }

  /** OAuth: 사용자가 로그인 창 닫음 */
  static cancelled(): AuthClientError {
    return new AuthClientError('cancelled', '로그인이 취소되었어요');
  }

  /** OAuth: 네트워크 연결 없음 */
  static network(): AuthClientError {
    return new AuthClientError('network', '네트워크 연결을 확인해주세요');
  }

  /** Repository: safeParse 실패 */
  static validation(): AuthClientError {
    return new AuthClientError('validation', '잘못된 응답 형식이에요');
  }

  /** 예상치 못한 에러 */
  static unknown(message?: string): AuthClientError {
    return new AuthClientError('unknown', message ?? '알 수 없는 오류가 발생했어요');
  }
}
