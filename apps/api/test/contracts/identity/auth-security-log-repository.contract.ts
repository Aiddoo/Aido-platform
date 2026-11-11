import type {
  AuthSecurityLogRepositoryPort,
  NewSecurityLog,
} from "#api/modules/identity/auth/application/ports/auth-security-log.repository.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  type SecurityLogRecord,
  toSecurityLogRecord,
} from "#test/doubles/identity/in-memory-auth-security-log.repository";
import { AUTH_FIXTURE_USER_ID } from "#test/fixtures/identity/auth-session.fixture";

// 보안 로그는 쓰기만 하는 감사 기록이라 포트에 조회가 없다. 계약은 저장소마다 남은 기록을 읽는 방법을 받는다
export interface AuthSecurityLogRepositorySubject {
  readonly repository: AuthSecurityLogRepositoryPort;
  readonly listEntries: () => Promise<readonly SecurityLogRecord[]>;
}

export function describeAuthSecurityLogRepositoryContract(
  createSubject: () => Promise<AuthSecurityLogRepositorySubject>,
): void {
  describe("보안 로그 저장소 계약", () => {
    it("사용자·이벤트·접속 정보·메타데이터를 남긴 순서대로 기록한다", async () => {
      // Given
      const { repository, listEntries } = await createSubject();
      const entries: NewSecurityLog[] = [
        {
          userId: UserId.reconstitute(AUTH_FIXTURE_USER_ID),
          event: "LOGIN_SUCCESS",
          ipAddress: "127.0.0.1",
          userAgent: "Aido/1.15.1",
          metadata: { provider: "GOOGLE" },
        },
        {
          userId: UserId.reconstitute(AUTH_FIXTURE_USER_ID),
          event: "LOGOUT",
          ipAddress: "127.0.0.2",
          userAgent: "Aido/1.15.1",
        },
      ];

      // When
      for (const entry of entries) {
        await repository.create(entry);
      }

      // Then
      expect(await listEntries()).toEqual(entries.map(toSecurityLogRecord));
    });

    it("사용자를 모르는 잠금 기록도 남긴다", async () => {
      // Given
      const { repository, listEntries } = await createSubject();
      const entry: NewSecurityLog = {
        event: "ACCOUNT_LOCKED",
        ipAddress: "unknown",
        userAgent: "unknown",
        metadata: { email: "locked@example.com", recentFailures: 5 },
      };

      // When
      await repository.create(entry);

      // Then
      expect(await listEntries()).toEqual([toSecurityLogRecord(entry)]);
    });
  });
}
