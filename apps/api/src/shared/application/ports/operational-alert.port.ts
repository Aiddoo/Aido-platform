import type { AlertDefinition } from "../alerts/define-alerts.js";

/**
 * 사람이 확인해야 하는 운영 상황 하나. slice `*.alerts.ts`의 정의를 펼쳐 만든다(`{ ...TodoAlerts.X, tags }`).
 * key가 같으면 한 이슈로 모인다. tags·details에는 고정 기호와 id·숫자만 넣고 사용자 원문·토큰·키·공급자 message는 넣지 않는다.
 */
export interface OperationalAlert extends AlertDefinition {
  /**
   * 한 정의 안에서 원인을 나누는 고정 기호(큐·스케줄 key·오류 종류). 있으면 `<key>:<subject>`가 이슈·중복 제거 단위다.
   * 사용자마다 달라지는 값은 넣지 않는다.
   */
  readonly subject?: string;
  readonly tags?: Readonly<Record<string, string>>;
  readonly details?: Readonly<Record<string, string | number | boolean | null>>;
  /**
   * 응답이 성공이라 전역 필터가 잡지 못하는 실패의 원인 예외. 로그에는 스택을 남기지 않아 원인을 찾을 유일한 자리다.
   * 5xx 전역 필터처럼 예외 메시지도 함께 간다.
   */
  readonly cause?: unknown;
}

/** Sentry 이슈와 중복 제거를 가르는 단위. 원인을 나누는 subject가 있으면 key 뒤에 붙인다. */
export function alertIssueKey(alert: Pick<OperationalAlert, "key" | "subject">): string {
  return alert.subject == null ? alert.key : `${alert.key}:${alert.subject}`;
}

/** 운영 경보를 올린다. 경보 실패는 호출 흐름에 전파하지 않는다(never throws). */
export abstract class OperationalAlertPort {
  abstract raise(alert: OperationalAlert): void;
}
