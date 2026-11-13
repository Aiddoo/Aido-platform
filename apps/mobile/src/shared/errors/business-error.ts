import { AppError, type AppErrorOptions } from '@src/core/errors/app-error';

/**
 * 앱이 직접 판단한 예상된 거절. 코드만 들고 있고 사용자 문구는 `errors` 카탈로그의 코드 키로
 * `getUserFacingMessage`가 고른다. 서버 코드와 앱 코드가 같은 길을 쓴다.
 */
export class BusinessError<TCode extends string = string> extends AppError {
  // 하위 클래스(SubscriptionError)가 이름을 바꿔 Sentry breadcrumb에 남긴다
  override readonly name: string = 'BusinessError';
  readonly code: TCode;

  constructor(code: TCode, options?: AppErrorOptions) {
    super(code, options);
    this.code = code;
  }
}
