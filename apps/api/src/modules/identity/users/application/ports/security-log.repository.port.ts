import type { SecurityEvent } from "#api/modules/identity/users/domain/users.constants";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

export interface NewSecurityLog {
  readonly userId?: UserId;
  readonly event: SecurityEvent;
  readonly ipAddress: string;
  readonly userAgent: string;
  readonly metadata?: Record<string, unknown>;
}

export abstract class SecurityLogRepositoryPort {
  abstract create(entry: NewSecurityLog): Promise<void>;
  abstract deleteRecordedBefore(cutoff: Temporal.Instant, limit: number): Promise<number>;
}
