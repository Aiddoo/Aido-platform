/**
 * 예외 하나를 보고할 때 함께 싣는 문맥. tags는 고정 기호·id·숫자만 넣고
 * 사용자 원문·토큰·IP는 넣지 않는다. 사용자는 ID만 싣는다.
 */
export interface ExceptionReportContext {
  readonly userId: string | null;
  readonly tags: Readonly<Record<string, string>>;
  readonly extras?: Readonly<Record<string, unknown>>;
  /** 이미 분류된 실패(오류 코드)를 스택과 상관없이 한 이슈로 모으는 키. 없으면 스택으로 모은다 */
  readonly groupKey?: string;
}

/** 5xx·미분류 예외를 사람이 볼 곳(Sentry)으로 보낸다. 보고 실패는 호출 흐름에 전파하지 않는다(never throws). */
export abstract class ExceptionReporterPort {
  abstract report(error: unknown, context: ExceptionReportContext): void;
}
