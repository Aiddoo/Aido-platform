import { ErrorCode } from "@aido/api/errors";
import { vi } from "vitest";

import { UserFixture } from "#test/fixtures/index";
import { StubAccountLifecycleRepository } from "#test/mocks/ports/account-lifecycle.stub";
import { StubAuthSecurityLogRepository } from "#test/mocks/ports/auth-session.stub";

import { IdentityUser } from "../../../domain/aggregates/auth/identity-user.aggregate.js";
import { AUTH_DEFAULTS, SECURITY_EVENT } from "../../../domain/constants/auth/auth.constants.js";
import { RestoreAccount } from "./restore-account.use-case.js";

const currentTime = new Date("2026-12-31T23:59:00Z");
const deletedAt = new Date("2026-12-02T23:59:00Z");
const userId = "user-123";

describe("RestoreAccount — 탈퇴 유예 기간 내 계정 복구", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(currentTime);
  });
  afterEach(() => vi.useRealTimers());

  function givenUser(overrides: Parameters<typeof UserFixture.create>[0] = {}) {
    const record = UserFixture.create({
      id: userId,
      status: "SUSPENDED",
      deletedAt,
      emailVerifiedAt: null,
      ...overrides,
    });
    const userRepository = new StubAccountLifecycleRepository([record]);
    const securityLogRepository = new StubAuthSecurityLogRepository();
    const useCase = new RestoreAccount({ userRepository, securityLogRepository });
    return {
      useCase,
      userRepository,
      securityLogRepository,
      user: IdentityUser.reconstitute(record),
    };
  }

  it("계정 상태와 탈퇴 시각을 복구하고 기존 미인증 상태를 유지하며 복구 이력을 기록한다", async () => {
    // Given
    const fixture = givenUser();
    const metadata = { ip: "192.0.2.1", userAgent: "Aido-Test/1.0" };

    // When
    await fixture.useCase.execute({ user: fixture.user, at: currentTime, metadata });

    // Then
    expect(fixture.userRepository.users.get(userId)).toEqual(
      expect.objectContaining({ status: "ACTIVE", deletedAt: null, emailVerifiedAt: null }),
    );
    expect(fixture.user.status).toBe("ACTIVE");
    expect(fixture.user.deletedAt).toBeNull();
    expect(fixture.securityLogRepository.entries).toEqual([
      {
        userId,
        event: SECURITY_EVENT.ACCOUNT_RESTORED,
        ipAddress: metadata.ip,
        userAgent: metadata.userAgent,
        metadata: { deletedAt: deletedAt.toISOString(), restoredAt: currentTime.toISOString() },
      },
    ]);
  });

  it("요청 정보가 없으면 기존 기본값으로 복구 이력을 기록한다", async () => {
    // Given
    const fixture = givenUser();

    // When
    await fixture.useCase.execute({ user: fixture.user, at: currentTime });

    // Then
    expect(fixture.securityLogRepository.entries).toEqual([
      expect.objectContaining({
        ipAddress: AUTH_DEFAULTS.UNKNOWN_IP,
        userAgent: AUTH_DEFAULTS.UNKNOWN_USER_AGENT,
      }),
    ]);
  });

  it("탈퇴하지 않은 계정은 상태를 바꾸거나 복구 이력을 생성하지 않는다", async () => {
    // Given
    const fixture = givenUser({ status: "LOCKED", deletedAt: null });

    // When
    await fixture.useCase.execute({ user: fixture.user, at: currentTime });

    // Then
    expect(fixture.userRepository.users.get(userId)?.status).toBe("LOCKED");
    expect(fixture.securityLogRepository.entries).toEqual([]);
  });

  it("유예 기간이 지난 계정은 복구하거나 보안 기록을 생성하지 않는다", async () => {
    // Given
    const fixture = givenUser({ deletedAt: new Date("2026-11-30T23:59:00Z") });

    // When
    const pending = fixture.useCase.execute({ user: fixture.user, at: currentTime });

    // Then
    await expect(pending).rejects.toMatchObject({
      errorCode: ErrorCode.USER_0606,
      details: { userId },
    });
    expect(fixture.userRepository.users.get(userId)?.status).toBe("SUSPENDED");
    expect(fixture.securityLogRepository.entries).toEqual([]);
  });

  it("계정 복구 저장이 실패하면 오류를 전파하고 복구 이력을 기록하지 않는다", async () => {
    // Given
    const fixture = givenUser();
    vi.spyOn(fixture.userRepository, "restore").mockRejectedValueOnce(
      new Error("Restore write failed"),
    );

    // When
    const pending = fixture.useCase.execute({ user: fixture.user, at: currentTime });

    // Then
    await expect(pending).rejects.toThrow("Restore write failed");
    expect(fixture.securityLogRepository.entries).toEqual([]);
  });

  it("복구 감사 기록이 실패하면 호출자의 저장 경계로 오류를 전파한다", async () => {
    // Given
    const fixture = givenUser();
    vi.spyOn(fixture.securityLogRepository, "create").mockRejectedValueOnce(
      new Error("Audit write failed"),
    );

    // When
    const pending = fixture.useCase.execute({ user: fixture.user, at: currentTime });

    // Then
    await expect(pending).rejects.toThrow("Audit write failed");
  });
});
