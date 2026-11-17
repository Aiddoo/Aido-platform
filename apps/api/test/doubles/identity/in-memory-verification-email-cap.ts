import { VerificationEmailCapPort } from "#api/modules/identity/verifications/application/ports/verification-email-cap.port";

export class InMemoryVerificationEmailCap extends VerificationEmailCapPort {
  readonly #sentAts = new Map<string, readonly Temporal.Instant[]>();

  async findSentAts(email: string): Promise<readonly Temporal.Instant[]> {
    return this.#sentAts.get(email.trim().toLowerCase()) ?? [];
  }

  async saveSentAts(email: string, sentAts: readonly Temporal.Instant[]): Promise<void> {
    this.#sentAts.set(email.trim().toLowerCase(), sentAts);
  }
}
