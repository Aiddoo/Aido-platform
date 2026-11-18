import { VERIFICATION_CODE } from "@aido/api/vocabulary";

import { PasswordResetCooldownPort } from "#api/modules/identity/linked-accounts/application/ports/password-reset-cooldown.port";

export class InMemoryPasswordResetCooldown extends PasswordResetCooldownPort {
  readonly #startedAt = new Map<string, Temporal.Instant>();

  async findStartedAt(email: string, now: Temporal.Instant): Promise<Temporal.Instant | null> {
    const startedAt = this.#startedAt.get(email.trim().toLowerCase());
    if (startedAt == null) {
      return null;
    }
    const endsAt = startedAt.add({ seconds: VERIFICATION_CODE.RESEND_COOLDOWN_SECONDS });
    return Temporal.Instant.compare(now, endsAt) < 0 ? startedAt : null;
  }

  async start(email: string, now: Temporal.Instant): Promise<void> {
    this.#startedAt.set(email.trim().toLowerCase(), now);
  }
}
