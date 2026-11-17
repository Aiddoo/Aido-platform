import {
  type VerificationEmailCapBucket,
  VerificationEmailCapPort,
} from "#api/modules/identity/verifications/application/ports/verification-email-cap.port";

function bucketKey(bucket: VerificationEmailCapBucket): string {
  return JSON.stringify(
    "email" in bucket ? { ...bucket, email: bucket.email.trim().toLowerCase() } : bucket,
  );
}

export class InMemoryVerificationEmailCap extends VerificationEmailCapPort {
  readonly #sentAts = new Map<string, readonly Temporal.Instant[]>();

  async findSentAts(bucket: VerificationEmailCapBucket): Promise<readonly Temporal.Instant[]> {
    return this.#sentAts.get(bucketKey(bucket)) ?? [];
  }

  async saveSentAts(
    bucket: VerificationEmailCapBucket,
    sentAts: readonly Temporal.Instant[],
  ): Promise<void> {
    this.#sentAts.set(bucketKey(bucket), sentAts);
  }
}
