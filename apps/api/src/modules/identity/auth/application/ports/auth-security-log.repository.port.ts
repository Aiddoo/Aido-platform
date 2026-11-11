import type { SecurityEvent } from "@aido/api/vocabulary";

import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

export interface NewSecurityLog {
  readonly userId?: UserId;
  readonly event: SecurityEvent;
  readonly ipAddress: string;
  readonly userAgent: string;
  readonly metadata?: Record<string, unknown>;
}

export abstract class AuthSecurityLogRepositoryPort {
  abstract create(entry: NewSecurityLog): Promise<void>;
}
