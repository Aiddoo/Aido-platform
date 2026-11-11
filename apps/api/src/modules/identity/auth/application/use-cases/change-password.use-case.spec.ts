import { ErrorCode } from "@aido/api/errors";
import { REVOKE_REASON, SECURITY_EVENT } from "@aido/api/vocabulary";

import { InMemoryAuthAccountRepository } from "#test/doubles/identity/in-memory-auth-account.repository";
import {
  AUTH_CREDENTIAL_NOW,
  AUTH_CREDENTIAL_PASSWORD,
  createAuthCredentialFixture,
} from "#test/fixtures/auth-credential.fixture";
import { createAuthAccountFixture } from "#test/fixtures/identity/auth-credential.fixture";
import {
  createAuthSessionFixture,
  createIdentityUserFixture,
} from "#test/fixtures/identity/auth-session.fixture";

import { ChangePasswordUseCase } from "./change-password.use-case.js";

const newPassword = "NewPassword2!";

async function givenSessions(
  fixture: ReturnType<typeof createAuthCredentialFixture>,
  sessions: readonly { readonly id: string; readonly userId: string }[],
) {
  for (const session of sessions) {
    await fixture.sessionRepository.save(createAuthSessionFixture(session));
    fixture.cacheService.sessionIds.add(session.id);
  }
}

describe("ChangePassword — 현재 기기를 유지하는 비밀번호 변경", () => {
  it("현재 기기와 다른 사용자는 유지하고 나머지 폐기 세션 캐시만 삭제한다", async () => {
    // Given
    const fixture = createAuthCredentialFixture();
    const useCase = new ChangePasswordUseCase(fixture);
    await givenSessions(fixture, [
      { id: "current-device", userId: fixture.user.id },
      { id: "other-device", userId: fixture.user.id },
      { id: "other-user-device", userId: "other-user" },
    ]);
    const metadata = { ip: "192.0.2.11", userAgent: "현재 기기" };

    // When
    const result = await useCase.execute({
      userId: fixture.user.id,
      currentPassword: AUTH_CREDENTIAL_PASSWORD,
      newPassword,
      currentSessionId: "current-device",
      metadata,
    });

    // Then
    expect(result.message).toBe("비밀번호가 변경되었습니다.");
    expect(fixture.accountRepository.all.map((account) => account.password)).toEqual([
      `digest:${newPassword}`,
    ]);
    expect(fixture.sessionRepository.stored("other-device")?.revokedAt).toEqual(
      AUTH_CREDENTIAL_NOW,
    );
    expect(fixture.sessionRepository.revocationReasons).toEqual(
      new Map([["other-device", REVOKE_REASON.PASSWORD_CHANGED]]),
    );
    expect(fixture.cacheService.sessionIds).toEqual(
      new Set(["current-device", "other-user-device"]),
    );
    expect(fixture.pushDevices.releasedSessionIds).toEqual(["other-device"]);
    for (const sessionId of ["current-device", "other-user-device"]) {
      expect(fixture.sessionRepository.stored(sessionId)?.revokedAt).toBeNull();
    }
    expect(fixture.securityLogRepository.entries).toEqual([
      {
        userId: fixture.user.id,
        event: SECURITY_EVENT.PASSWORD_CHANGED,
        ipAddress: metadata.ip,
        userAgent: metadata.userAgent,
      },
    ]);
  });

  it("현재 세션을 지정하지 않은 기존 호출은 모든 기기를 폐기한다", async () => {
    // Given
    const fixture = createAuthCredentialFixture();
    const useCase = new ChangePasswordUseCase(fixture);
    await givenSessions(fixture, [{ id: "only-device", userId: fixture.user.id }]);

    // When
    await useCase.execute({
      userId: fixture.user.id,
      currentPassword: AUTH_CREDENTIAL_PASSWORD,
      newPassword,
    });

    // Then
    expect(fixture.sessionRepository.stored("only-device")?.revokedAt).toEqual(AUTH_CREDENTIAL_NOW);
    expect(fixture.cacheService.sessionIds.size).toBe(0);
  });

  it.each(["존재하지 않는", "탈퇴한", "소셜 전용", "비밀번호가 없는"] as const)(
    "%s 사용자의 변경은 해싱과 쓰기 이전에 거부한다",
    async (state) => {
      // Given
      const fixture = createAuthCredentialFixture({
        empty: state === "존재하지 않는",
        socialOnly: state === "소셜 전용",
      });
      if (state === "탈퇴한") {
        await fixture.userRepository.saveAccountStatus(
          createIdentityUserFixture({
            ...fixture.user,
            status: "SUSPENDED",
            deletedAt: AUTH_CREDENTIAL_NOW,
          }),
        );
      }
      const accountRepository =
        state === "비밀번호가 없는"
          ? new InMemoryAuthAccountRepository([
              createAuthAccountFixture({ userId: fixture.user.id, password: null }),
            ])
          : fixture.accountRepository;
      const useCase = new ChangePasswordUseCase({ ...fixture, accountRepository });
      const errorCode =
        state === "존재하지 않는"
          ? ErrorCode.USER_0601
          : state === "탈퇴한"
            ? ErrorCode.USER_0606
            : ErrorCode.USER_0613;

      // When
      const pending = useCase.execute({
        userId: fixture.user.id,
        currentPassword: AUTH_CREDENTIAL_PASSWORD,
        newPassword,
      });

      // Then
      await expect(pending).rejects.toMatchObject({ errorCode });
      expect(fixture.passwordService.hashes).toEqual([]);
      expect(fixture.securityLogRepository.entries).toEqual([]);
    },
  );

  it("현재 비밀번호가 틀리면 비밀번호·세션·캐시를 유지한다", async () => {
    // Given
    const fixture = createAuthCredentialFixture();
    const useCase = new ChangePasswordUseCase(fixture);
    await givenSessions(fixture, [{ id: "only-device", userId: fixture.user.id }]);

    // When
    const pending = useCase.execute({
      userId: fixture.user.id,
      currentPassword: "WrongPassword!",
      newPassword,
    });

    // Then
    await expect(pending).rejects.toMatchObject({ errorCode: ErrorCode.USER_0602 });
    expect(fixture.accountRepository.all.map((account) => account.password)).toEqual([
      `digest:${AUTH_CREDENTIAL_PASSWORD}`,
    ]);
    expect(fixture.passwordService.hashes).toEqual([]);
    expect(fixture.sessionRepository.stored("only-device")?.revokedAt).toBeNull();
    expect(fixture.cacheService.sessionIds.has("only-device")).toBe(true);
    expect(fixture.securityLogRepository.entries).toEqual([]);
  });
});
