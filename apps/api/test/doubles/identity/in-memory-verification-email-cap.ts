import {
  type VerificationEmailCapBucket,
  VerificationEmailCapPort,
} from "#api/modules/identity/verifications/application/ports/verification-email-cap.port";
import { requestSourceKey } from "#api/platform/throttle/request-source-key";

function bucketKey(bucket: VerificationEmailCapBucket): string {
  if (bucket.scope === "user") {
    return JSON.stringify(bucket);
  }
  const email = bucket.email.trim().toLowerCase();
  return JSON.stringify(
    bucket.scope === "email-source"
      ? { ...bucket, email, sourceIp: requestSourceKey(bucket.sourceIp) }
      : { ...bucket, email },
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
