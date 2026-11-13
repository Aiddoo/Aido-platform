export interface AppErrorOptions {
  /** 이 오류를 낳은 원래 오류. Sentry가 묶어 보여 준다 */
  cause?: unknown;
}

/** 앱 오류 클래스의 바탕. 이름은 하위 클래스의 `name` 필드 하나로 정하고 원인은 `cause`로 넘긴다 */
export abstract class AppError extends Error {
  abstract override readonly name: string;

  constructor(message: string, { cause }: AppErrorOptions = {}) {
    super(message);
    // `new Error(msg, { cause })`는 Hermes가 무시할 수 있어 직접 대입한다
    if (cause != null) {
      this.cause = cause;
    }
  }
}
