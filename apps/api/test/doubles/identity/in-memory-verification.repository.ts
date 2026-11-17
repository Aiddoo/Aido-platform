import {
  VerificationRepositoryPort,
  type ConsumeVerificationInput,
} from "#api/modules/identity/verifications/application/ports/verification.repository.port";
import { VerificationId } from "#api/modules/identity/verifications/domain/verification-id.vo";
import {
  Verification,
  type VerificationPrimitives,
} from "#api/modules/identity/verifications/domain/verification.aggregate";
import type { VerificationType } from "#api/modules/identity/verifications/domain/verifications.constants";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

function isAfter(left: Temporal.Instant, right: Temporal.Instant): boolean {
  return Temporal.Instant.compare(left, right) > 0;
}

export class InMemoryVerificationRepository extends VerificationRepositoryPort {
  readonly #verifications = new Map<number, VerificationPrimitives>();
  #sequence: number;

  constructor(verifications: readonly Verification[] = []) {
    super();
    for (const verification of verifications) {
      this.#verifications.set(verification.id.value, verification.toPrimitives());
    }
    this.#sequence = Math.max(0, ...this.#verifications.keys());
  }

  get all(): readonly VerificationPrimitives[] {
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
  ): Promise<Verification | null> {
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
    return latest == null ? null : Verification.reconstitute(latest);
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

  async save(verification: Verification): Promise<void> {
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

  async consume(input: ConsumeVerificationInput): Promise<boolean> {
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
