import type { AccountProvider } from "../../../linked-accounts/domain/linked-accounts.constants.js";

export interface NewLoginAttempt {
  readonly email: string;
  readonly provider?: AccountProvider;
  readonly ipAddress: string;
  readonly userAgent: string;
  readonly success: boolean;
  readonly failureReason?: string;
  readonly attemptedAt: Temporal.Instant;
}

export interface RecentLoginFailuresQuery {
  readonly email: string;
  readonly ipAddress: string;
  readonly since: Temporal.Instant;
}

/** 같은 이메일의 since 뒤 실패 수. 보낸 곳은 IP 요청 한도와 같은 기준(IPv6는 /64 대역)으로 묶는다 */
export interface RecentLoginFailures {
  readonly byEmail: number;
  readonly bySource: number;
}

export abstract class LoginAttemptRepositoryPort {
  /** 호출자 트랜잭션이 롤백돼도 시도 기록이 남아야 한다 */
  abstract create(attempt: NewLoginAttempt): Promise<void>;
  abstract countRecentFailures(query: RecentLoginFailuresQuery): Promise<RecentLoginFailures>;
  abstract deleteAttemptedBefore(cutoff: Temporal.Instant, limit: number): Promise<number>;
}
