import {
  LoginAttemptRepositoryPort,
  type NewLoginAttempt,
} from "#api/modules/identity/sessions/application/ports/login-attempt.repository.port";

export class InMemoryLoginAttemptRepository extends LoginAttemptRepositoryPort {
  readonly attempts: NewLoginAttempt[] = [];

  async create(attempt: NewLoginAttempt): Promise<void> {
    this.attempts.push(attempt);
  }

  async countRecentFailuresByEmail(email: string, since: Temporal.Instant): Promise<number> {
    return this.attempts.filter(
      (attempt) =>
        attempt.email === email &&
        !attempt.success &&
        Temporal.Instant.compare(attempt.attemptedAt, since) >= 0,
    ).length;
  }

  async deleteAttemptedBefore(cutoff: Temporal.Instant, limit: number): Promise<number> {
    const oldAttempts = this.attempts
      .filter((attempt) => Temporal.Instant.compare(attempt.attemptedAt, cutoff) < 0)
      .slice(0, limit);
    for (const attempt of oldAttempts) {
      this.attempts.splice(this.attempts.indexOf(attempt), 1);
    }
    return oldAttempts.length;
  }
}
