import type { AccountProvider } from "../../domain/auth.constants.js";

export interface NewLoginAttempt {
  readonly email: string;
  readonly provider?: AccountProvider;
  readonly ipAddress: string;
  readonly userAgent: string;
  readonly success: boolean;
  readonly failureReason?: string;
  readonly attemptedAt: Temporal.Instant;
}

export abstract class AuthLoginAttemptRepositoryPort {
  /** 호출자 트랜잭션이 롤백돼도 시도 기록이 남아야 한다 */
  abstract create(attempt: NewLoginAttempt): Promise<void>;
  abstract countRecentFailuresByEmail(email: string, since: Temporal.Instant): Promise<number>;
}
