export const OPERATIONAL_ALERT = Symbol("OPERATIONAL_ALERT");

export type OperationalAlertSeverity = "warning" | "error";

/**
 * 사람이 확인해야 하는 운영 상황 하나. key가 같으면 한 이슈로 모인다.
 * tags·details에는 고정 기호와 id·숫자만 넣고 사용자 원문·토큰·키·공급자 message는 넣지 않는다.
 */
export interface OperationalAlert {
  readonly key: string;
  readonly severity: OperationalAlertSeverity;
  readonly message: string;
  readonly tags?: Readonly<Record<string, string>>;
  readonly details?: Readonly<Record<string, string | number | boolean | null>>;
  /**
   * 응답이 성공이라 전역 필터가 잡지 못하는 실패의 원인 예외. 로그에는 스택을 남기지 않아 원인을 찾을 유일한 자리다.
   * 5xx 전역 필터처럼 예외 메시지도 함께 간다.
   */
  readonly cause?: unknown;
}

/** 운영 경보를 올린다. 경보 실패는 호출 흐름에 전파하지 않는다(never throws). */
export interface OperationalAlertPort {
  raise(alert: OperationalAlert): void;
}
