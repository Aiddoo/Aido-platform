/**
 * 앱이 직접 판단한 예상된 거절. 코드만 들고 있고 사용자 문구는 `errors` 카탈로그의 코드 키로
 * `getUserFacingMessage`가 고른다. 서버 코드와 앱 코드가 같은 길을 쓴다.
 */
export class BusinessError<TCode extends string = string> extends Error {
  override readonly name: string = 'BusinessError';
  readonly code: TCode;

  constructor(code: TCode) {
    super(code);
    this.code = code;
  }
}
