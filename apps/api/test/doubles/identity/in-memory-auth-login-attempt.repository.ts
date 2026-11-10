import {
  AuthLoginAttemptRepositoryPort,
  type NewLoginAttempt,
} from "#api/modules/identity/auth/application/ports/auth-login-attempt.repository.port";

export class InMemoryAuthLoginAttemptRepository extends AuthLoginAttemptRepositoryPort {
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
}
