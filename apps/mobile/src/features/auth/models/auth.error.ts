/**
 * 서버 API 응답 에러
 * - HTTP 클라이언트가 API 호출 후 받는 에러
 * - 서버가 반환한 error.code로 구분
 */
export class AuthApiError extends Error {
  constructor(
    message: string,
    readonly serverCode?: string,
  ) {
    super(message);
    this.name = 'AuthApiError';
  }
}

/**
 * 클라이언트 자체 에러
 * - 서버 호출 이전에 발생하는 에러
 * - cancelled: 사용자가 로그인 창 닫음
 * - network: 네트워크 연결 없음
 * - validation: 콜백 URL에서 code 파싱 실패
 * - unknown: 예상치 못한 에러
 */
export class AuthClientError extends Error {
  constructor(
    message: string,
    readonly reason: 'cancelled' | 'network' | 'validation' | 'unknown',
  ) {
    super(message);
    this.name = 'AuthClientError';
  }
}
