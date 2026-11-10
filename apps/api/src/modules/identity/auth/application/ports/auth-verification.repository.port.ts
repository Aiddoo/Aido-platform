import type { AuthVerification } from "../../domain/auth-verification.aggregate.js";
import type { VerificationType } from "../../domain/auth.constants.js";

export interface ConsumeAuthVerificationInput {
  id: number;
  userId: string;
  type: VerificationType;
  tokenHash: string;
  maxAttempts: number;
  at: Temporal.Instant;
}

export abstract class AuthVerificationRepositoryPort {
  abstract create(data: {
    userId: string;
    type: VerificationType;
    token: string;
    expiresAt: Date;
  }): Promise<unknown>;
  abstract findValidByUserIdAndType(
    userId: string,
    type: VerificationType,
    now: Temporal.Instant,
  ): Promise<AuthVerification | null>;
  abstract consume(input: ConsumeAuthVerificationInput): Promise<boolean>;
  abstract incrementAttempts(id: number): Promise<unknown>;
  abstract invalidateAllByUserIdAndType(userId: string, type: VerificationType): Promise<number>;
  abstract countRecentByUserIdAndType(
    userId: string,
    type: VerificationType,
    since: Date,
  ): Promise<number>;
}
