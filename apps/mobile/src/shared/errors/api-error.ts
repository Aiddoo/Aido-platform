/**
 * API 에러 클래스
 * 서버에서 반환하는 에러 응답을 표현
 */
export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
