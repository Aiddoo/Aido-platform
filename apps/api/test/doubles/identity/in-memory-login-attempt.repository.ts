import {
  LoginAttemptRepositoryPort,
  type NewLoginAttempt,
  type RecentLoginFailures,
  type RecentLoginFailuresQuery,
} from "#api/modules/identity/sessions/application/ports/login-attempt.repository.port";
import { requestSourceKey } from "#api/platform/throttle/request-source-key";

export class InMemoryLoginAttemptRepository extends LoginAttemptRepositoryPort {
  readonly attempts: NewLoginAttempt[] = [];

  async create(attempt: NewLoginAttempt): Promise<void> {
    this.attempts.push(attempt);
  }

  async countRecentFailures(query: RecentLoginFailuresQuery): Promise<RecentLoginFailures> {
    const failures = this.attempts.filter(
      (attempt) =>
        attempt.email === query.email &&
        !attempt.success &&
        Temporal.Instant.compare(attempt.attemptedAt, query.since) >= 0,
    );
    const source = requestSourceKey(query.ipAddress);
    return {
      byEmail: failures.length,
      bySource: failures.filter((attempt) => requestSourceKey(attempt.ipAddress) === source).length,
    };
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
