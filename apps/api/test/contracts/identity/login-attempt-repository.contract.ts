import type {
  LoginAttemptRepositoryPort,
  NewLoginAttempt,
} from "#api/modules/identity/sessions/application/ports/login-attempt.repository.port";
import { AUTH_FIXTURE_NOW } from "#test/fixtures/identity/session.fixture";

const EMAIL = "login@example.com";
const SOURCE_IP = "127.0.0.1";

function attempt(overrides: Partial<NewLoginAttempt> = {}): NewLoginAttempt {
  return {
    email: EMAIL,
    provider: "CREDENTIAL",
    ipAddress: SOURCE_IP,
    userAgent: "Aido/1.15.1",
    success: false,
    failureReason: "INVALID_PASSWORD",
    attemptedAt: AUTH_FIXTURE_NOW,
    ...overrides,
  };
}

export function describeLoginAttemptRepositoryContract(
  createRepository: () => Promise<LoginAttemptRepositoryPort>,
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
      const failures = await repository.countRecentFailures({
        email: EMAIL,
        ipAddress: SOURCE_IP,
        since: AUTH_FIXTURE_NOW,
      });

      // Then
      expect(failures).toEqual({ byEmail: 2, bySource: 2 });
    });

    it("같은 이메일의 실패를 보낸 곳마다 나눠 세고 IPv6는 /64 대역 하나를 한 곳으로 센다", async () => {
      // Given
      const repository = await createRepository();
      for (const ipAddress of [
        "2001:db8:1:2::1",
        "2001:db8:1:2::2",
        "2001:db8:1:3::1",
        SOURCE_IP,
      ]) {
        await repository.create(attempt({ ipAddress }));
      }

      // When
      const failures = await repository.countRecentFailures({
        email: EMAIL,
        ipAddress: "2001:db8:1:2:ffff::9",
        since: AUTH_FIXTURE_NOW,
      });

      // Then
      expect(failures).toEqual({ byEmail: 4, bySource: 2 });
    });

    it("공급자 없이 남긴 실패도 센다", async () => {
      // Given
      const repository = await createRepository();
      await repository.create(attempt({ provider: undefined }));

      // When
      const failures = await repository.countRecentFailures({
        email: EMAIL,
        ipAddress: SOURCE_IP,
        since: AUTH_FIXTURE_NOW,
      });

      // Then
      expect(failures).toEqual({ byEmail: 1, bySource: 1 });
    });

    it("기록이 없으면 0이다", async () => {
      // Given
      const repository = await createRepository();

      // When
      const failures = await repository.countRecentFailures({
        email: EMAIL,
        ipAddress: SOURCE_IP,
        since: AUTH_FIXTURE_NOW,
      });

      // Then
      expect(failures).toEqual({ byEmail: 0, bySource: 0 });
    });

    it("시도 시각이 기준 시각 전인 기록만 limit개씩 지운다", async () => {
      // Given
      const repository = await createRepository();
      await repository.create(
        attempt({ attemptedAt: AUTH_FIXTURE_NOW.subtract({ milliseconds: 1 }) }),
      );
      await repository.create(
        attempt({
          success: true,
          failureReason: undefined,
          attemptedAt: AUTH_FIXTURE_NOW.subtract({ hours: 1 }),
        }),
      );
      await repository.create(attempt());

      // When
      const deletedCounts = [
        await repository.deleteAttemptedBefore(AUTH_FIXTURE_NOW, 1),
        await repository.deleteAttemptedBefore(AUTH_FIXTURE_NOW, 1),
        await repository.deleteAttemptedBefore(AUTH_FIXTURE_NOW, 1),
      ];

      // Then
      expect(deletedCounts).toEqual([1, 1, 0]);
      expect(
        await repository.countRecentFailures({
          email: EMAIL,
          ipAddress: SOURCE_IP,
          since: AUTH_FIXTURE_NOW.subtract({ hours: 2 }),
        }),
      ).toEqual({ byEmail: 1, bySource: 1 });
    });
  });
}
