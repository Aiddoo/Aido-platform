/** 모든 사용자를 합친 사용량의 subject */
export const USAGE_SUBJECT_ALL = "*";

/** 계량기·기간·대상 하나. 기간은 usage-period의 UTC 일("2026-11-05")·월("2026-11") 키다. */
export interface UsageKey {
  readonly meter: string;
  readonly periodKey: string;
  /** USAGE_SUBJECT_ALL 또는 사용자 id */
  readonly subject: string;
}

export interface UsageIncrement {
  readonly key: UsageKey;
  readonly amount: number;
}

export interface UsageReservation {
  readonly isAccepted: boolean;
  /** 예약 뒤(거절이면 현재) 누적값 */
  readonly total: number;
}

/**
 * 외부 호출의 누적 사용량(비용·호출 수·발송 수). 같은 키는 원자적으로 더하므로 여러 요청이
 * 동시에 더해도 각자 받은 누적값이 서로 다르고, 기준선을 넘긴 요청은 정확히 하나다.
 */
export abstract class UsageMeterPort {
  /** 더한 뒤 누적값을 입력 순서대로 돌려준다 */
  abstract add(increments: readonly UsageIncrement[]): Promise<readonly number[]>;
  /** 누적값이 limit을 넘지 않을 때만 더한다 */
  abstract tryReserve(key: UsageKey, amount: number, limit: number): Promise<UsageReservation>;
  /** 예약을 되돌린다. 0 밑으로 내려가지 않는다. */
  abstract release(key: UsageKey, amount: number): Promise<void>;
  abstract read(keys: readonly UsageKey[]): Promise<readonly number[]>;
  /** cutoff 전에 마지막으로 바뀐 기간을 지운다 */
  abstract prune(cutoff: Temporal.Instant): Promise<number>;
  /** 사용자 id를 대상으로 한 모든 기간을 지운다(계정 영구 삭제) */
  abstract deleteSubject(subject: string): Promise<number>;
}
