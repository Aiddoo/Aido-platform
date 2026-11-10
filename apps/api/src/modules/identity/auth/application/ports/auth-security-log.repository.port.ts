import type { SecurityEvent } from "@aido/api/vocabulary";

export interface NewSecurityLog {
  readonly userId?: string;
  readonly event: SecurityEvent;
  readonly ipAddress: string;
  readonly userAgent: string;
  readonly metadata?: Record<string, unknown>;
}

export abstract class AuthSecurityLogRepositoryPort {
  abstract create(entry: NewSecurityLog): Promise<void>;
}
