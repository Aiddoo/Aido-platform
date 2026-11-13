import {
  AuthVerificationRepositoryPort,
  type ConsumeAuthVerificationInput,
} from "#api/modules/identity/auth/application/ports/auth-verification.repository.port";
import {
  AuthVerification,
  type AuthVerificationPrimitives,
} from "#api/modules/identity/auth/domain/auth-verification.aggregate";
import type { VerificationType } from "#api/modules/identity/auth/domain/auth.constants";
import { VerificationId } from "#api/modules/identity/auth/domain/verification-id.vo";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

function isAfter(left: Temporal.Instant, right: Temporal.Instant): boolean {
  return Temporal.Instant.compare(left, right) > 0;
}

export class InMemoryAuthVerificationRepository extends AuthVerificationRepositoryPort {
  readonly #verifications = new Map<number, AuthVerificationPrimitives>();
  #sequence: number;

  constructor(verifications: readonly AuthVerification[] = []) {
    super();
    for (const verification of verifications) {
      this.#verifications.set(verification.id.value, verification.toPrimitives());
    }
    this.#sequence = Math.max(0, ...this.#verifications.keys());
  }

  get all(): readonly AuthVerificationPrimitives[] {
    return [...this.#verifications.values()];
  }

  async nextId(): Promise<VerificationId> {
    this.#sequence += 1;
    return VerificationId.reconstitute(this.#sequence);
  }

  async findValidByUserIdAndType(
    userId: UserId,
    type: VerificationType,
    now: Temporal.Instant,
  ): Promise<AuthVerification | null> {
    const latest = this.all
      .filter(
        (verification) =>
          verification.userId === userId.value &&
          verification.type === type &&
          verification.usedAt == null &&
          isAfter(verification.expiresAt, now),
      )
      .toSorted(
        (left, right) =>
          Temporal.Instant.compare(right.createdAt, left.createdAt) || right.id - left.id,
      )[0];
    return latest == null ? null : AuthVerification.reconstitute(latest);
  }

  async findLatestIssuedAtByUserIdAndType(
    userId: UserId,
    type: VerificationType,
    since: Temporal.Instant,
  ): Promise<Temporal.Instant | null> {
    const issuedAts = this.all
      .filter(
        (verification) =>
          verification.userId === userId.value &&
          verification.type === type &&
          Temporal.Instant.compare(verification.createdAt, since) >= 0,
      )
      .map((verification) => verification.createdAt)
      .toSorted((left, right) => Temporal.Instant.compare(right, left));
    return issuedAts[0] ?? null;
  }

  async save(verification: AuthVerification): Promise<void> {
    const saved = verification.toPrimitives();
    const prior = this.#verifications.get(saved.id);
    this.#verifications.set(
      saved.id,
      prior == null
        ? saved
        : {
            ...prior,
            expiresAt: saved.expiresAt,
            attempts: saved.attempts,
            usedAt: saved.usedAt,
          },
    );
  }

  async invalidateAllByUserIdAndType(
    userId: UserId,
    type: VerificationType,
    now: Temporal.Instant,
  ): Promise<number> {
    const targets = this.all.filter(
      (verification) =>
        verification.userId === userId.value &&
        verification.type === type &&
        verification.usedAt == null &&
        isAfter(verification.expiresAt, now),
    );
    for (const verification of targets) {
      this.#verifications.set(verification.id, { ...verification, expiresAt: now });
    }
    return targets.length;
  }

  async consume(input: ConsumeAuthVerificationInput): Promise<boolean> {
    const verification = this.#verifications.get(input.id.value);
    if (
      verification == null ||
      verification.userId !== input.userId.value ||
      verification.type !== input.type ||
      verification.tokenHash !== input.tokenHash ||
      verification.usedAt != null ||
      !isAfter(verification.expiresAt, input.at) ||
      verification.attempts >= input.maxAttempts
    ) {
      return false;
    }
    this.#verifications.set(input.id.value, { ...verification, usedAt: input.at });
    return true;
  }

  async incrementAttempts(verificationId: VerificationId): Promise<void> {
    const verification = this.#verifications.get(verificationId.value);
    if (verification == null) {
      return;
    }
    this.#verifications.set(verificationId.value, {
      ...verification,
      attempts: verification.attempts + 1,
    });
  }
}
