import type { AccountProvider } from "../../domain/auth.constants.js";

export abstract class AuthLoginAttemptRepositoryPort {
  abstract create(data: {
    email: string;
    provider?: AccountProvider;
    ipAddress: string;
    userAgent: string;
    success: boolean;
    failureReason?: string;
  }): Promise<unknown>;
  abstract countRecentFailuresByEmail(email: string, since: Date): Promise<number>;
}
