import { VERIFICATION_CODE } from "@aido/api/vocabulary";

import { VerificationRepositoryPort } from "#api/modules/identity/verifications/application/ports/verification.repository.port";
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

  seed(verification: Verification): void {
    this.#verifications.set(verification.id.value, verification.toPrimitives());
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
          Temporal.Instant.compare(verification.createdAt, since) > 0,
      )
      .map((verification) => verification.createdAt)
      .toSorted((left, right) => Temporal.Instant.compare(right, left));
    return issuedAts[0] ?? null;
  }

  // Drizzle 저장소와 같은 조건이다. 읽은 코드는 소비만 저장하고 쓰였거나 만료·소진됐으면 false다
  async save(verification: Verification): Promise<boolean> {
    const saved = verification.toPrimitives();
    if (!verification.isPersisted()) {
      this.#verifications.set(saved.id, saved);
      return true;
    }
    const prior = this.#verifications.get(saved.id);
    if (
      prior == null ||
      saved.usedAt == null ||
      !verification.hasBeenConsumedSinceLoad() ||
      prior.usedAt != null ||
      prior.tokenHash !== saved.tokenHash ||
      !isAfter(prior.expiresAt, saved.usedAt) ||
      prior.attempts >= VERIFICATION_CODE.MAX_ATTEMPTS
    ) {
      return false;
    }
    this.#verifications.set(saved.id, { ...prior, usedAt: saved.usedAt });
    return true;
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

  async saveFailedAttempt(entity: Verification): Promise<void> {
    const verificationId = entity.id;
    const verification = this.#verifications.get(verificationId.value);
    if (
      verification == null ||
      verification.usedAt != null ||
      verification.attempts >= VERIFICATION_CODE.MAX_ATTEMPTS
    ) {
      return;
    }
    this.#verifications.set(verificationId.value, {
      ...verification,
      attempts: verification.attempts + 1,
    });
  }

  async deleteExpiredBefore(cutoff: Temporal.Instant, limit: number): Promise<number> {
    const expired = this.all
      .filter((verification) => isAfter(cutoff, verification.expiresAt))
      .slice(0, limit);
    for (const verification of expired) {
      this.#verifications.delete(verification.id);
    }
    return expired.length;
  }
}
