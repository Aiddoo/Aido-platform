import type {
  AuthLoginAttemptRepositoryPort,
  NewLoginAttempt,
} from "#api/modules/identity/auth/application/ports/auth-login-attempt.repository.port";
import { AUTH_FIXTURE_NOW } from "#test/fixtures/identity/auth-session.fixture";

const EMAIL = "login@example.com";

function attempt(overrides: Partial<NewLoginAttempt> = {}): NewLoginAttempt {
  return {
    email: EMAIL,
    provider: "CREDENTIAL",
    ipAddress: "127.0.0.1",
    userAgent: "Aido/1.15.1",
    success: false,
    failureReason: "INVALID_PASSWORD",
    attemptedAt: AUTH_FIXTURE_NOW,
    ...overrides,
  };
}

export function describeAuthLoginAttemptRepositoryContract(
  createRepository: () => Promise<AuthLoginAttemptRepositoryPort>,
): void {
  describe("로그인 시도 저장소 계약", () => {
    it("최근 실패 수는 since와 같거나 뒤의 같은 이메일 실패만 센다", async () => {
      // Given
      const repository = await createRepository();
      await repository.create(attempt({ attemptedAt: AUTH_FIXTURE_NOW.subtract({ seconds: 1 }) }));
      await repository.create(attempt());
      await repository.create(attempt({ attemptedAt: AUTH_FIXTURE_NOW.add({ minutes: 1 }) }));
      await repository.create(attempt({ success: true, failureReason: undefined }));
      await repository.create(attempt({ email: "other@example.com" }));

      // When
      const count = await repository.countRecentFailuresByEmail(EMAIL, AUTH_FIXTURE_NOW);

      // Then
      expect(count).toBe(2);
    });

    it("공급자 없이 남긴 실패도 센다", async () => {
      // Given
      const repository = await createRepository();
      await repository.create(attempt({ provider: undefined }));

      // When
      const count = await repository.countRecentFailuresByEmail(EMAIL, AUTH_FIXTURE_NOW);

      // Then
      expect(count).toBe(1);
    });

    it("기록이 없으면 0이다", async () => {
      // Given
      const repository = await createRepository();

      // When
      const count = await repository.countRecentFailuresByEmail(EMAIL, AUTH_FIXTURE_NOW);

      // Then
      expect(count).toBe(0);
    });
  });
}
