import { ErrorCode } from "@aido/api/errors";
import { vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { AccountFixture, SessionFixture, UserFixture } from "#test/fixtures/index";
import {
  StubAccountLifecycleCache,
  StubAccountLifecycleRepository,
  StubAccountPasswordVerifier,
  StubAccountRepository,
} from "#test/mocks/ports/account-lifecycle.stub";
import {
  StubAuthSecurityLogRepository,
  StubAuthSessionRepository,
} from "#test/mocks/ports/auth-session.stub";
import { createUnitOfWorkMock } from "#test/mocks/ports/unit-of-work.mock";

import {
  ACCOUNT_DELETION,
  AUTH_DEFAULTS,
  REVOKE_REASON,
  SECURITY_EVENT,
} from "../../../domain/constants/auth/auth.constants.js";
import type { AccountProvider } from "../../../domain/types/auth/auth.types.js";
import { IdentityLogEvent } from "../../observability/auth/identity-log.events.js";
import { DeleteAccount } from "./delete-account.use-case.js";

const currentTime = new Date("2026-12-31T23:59:00Z");
const userId = "user-123";
const password = "CorrectPassword1!";

describe("DeleteAccount — 계정 탈퇴와 모든 기기의 접근 종료", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(currentTime);
  });
  afterEach(() => vi.useRealTimers());

  function givenAccount(provider: AccountProvider = "CREDENTIAL") {
    const userRepository = new StubAccountLifecycleRepository([UserFixture.create({ id: userId })]);
    const accountRepository = new StubAccountRepository([
      AccountFixture.create({
        userId,
        provider,
        password: provider === "CREDENTIAL" ? `digest:${password}` : null,
      }),
    ]);
    const sessionRepository = new StubAuthSessionRepository([
      SessionFixture.create({ userId, id: "my-session-1" }),
      SessionFixture.create({ userId, id: "my-session-2" }),
      SessionFixture.create({ userId: "other-user", id: "other-session" }),
    ]);
    const cacheService = new StubAccountLifecycleCache(
      [...sessionRepository.sessions.keys()],
      [userId, "other-user"],
    );
    const securityLogRepository = new StubAuthSecurityLogRepository();
    const passwordService = new StubAccountPasswordVerifier();
    const logger = mock<ApplicationLogger>();
    const useCase = new DeleteAccount({
      userRepository,
      accountRepository,
      sessionRepository,
      cacheService,
      securityLogRepository,
      passwordService,
      logger,
      unitOfWork: createUnitOfWorkMock(),
    });
    return {
      useCase,
      userRepository,
      accountRepository,
      sessionRepository,
      cacheService,
      securityLogRepository,
      passwordService,
      logger,
    };
  }

  it.each(["CREDENTIAL", "GOOGLE"] as const)(
    "%s 계정의 탈퇴 시 모든 세션과 내 프로필 캐시를 비우고 보안 기록을 남긴다",
    async (provider) => {
      // Given
      const fixture = givenAccount(provider);
      const metadata = { ip: "192.0.2.1", userAgent: "Aido-Test/1.0" };
      const reason = "사용하지 않아서";

      // When
      const result = await fixture.useCase.execute({
        userId,
        password: provider === "CREDENTIAL" ? password : undefined,
        reason,
        metadata,
      });

      // Then
      expect(result).toEqual({
        message: `계정이 탈퇴 처리되었습니다. ${ACCOUNT_DELETION.GRACE_PERIOD_DAYS}일 이내에 복구할 수 있습니다.`,
        deletedAt: currentTime.toISOString(),
        gracePeriodDays: ACCOUNT_DELETION.GRACE_PERIOD_DAYS,
      });
      expect(fixture.userRepository.users.get(userId)).toEqual(
        expect.objectContaining({ status: "SUSPENDED", deletedAt: currentTime }),
      );
      expect(fixture.sessionRepository.revocationReasons).toEqual(
        new Map([
          ["my-session-1", REVOKE_REASON.ACCOUNT_DELETION],
          ["my-session-2", REVOKE_REASON.ACCOUNT_DELETION],
        ]),
      );
      expect(fixture.cacheService.sessionIds).toEqual(new Set(["other-session"]));
      expect(fixture.cacheService.userIds).toEqual(new Set(["other-user"]));
      expect(fixture.securityLogRepository.entries).toEqual([
        {
          userId,
          event: SECURITY_EVENT.ACCOUNT_DELETION_REQUESTED,
          ipAddress: metadata.ip,
          userAgent: metadata.userAgent,
          metadata: {
            reason,
            gracePeriodDays: ACCOUNT_DELETION.GRACE_PERIOD_DAYS,
            providers: [provider],
          },
        },
      ]);
      expect(fixture.passwordService.checked).toEqual(
        provider === "CREDENTIAL" ? [{ hash: `digest:${password}`, password }] : [],
      );
      expect(fixture.logger.log).toHaveBeenCalledWith({
        event: IdentityLogEvent.ACCOUNT_DELETION_REQUESTED,
        userId,
      });
      const logs = JSON.stringify(fixture.logger.log.mock.calls);
      expect(logs).not.toContain(password);
      expect(logs).not.toContain(reason);
      expect(logs).not.toContain(metadata.ip);
    },
  );

  it("탈퇴 이유와 요청 정보가 없으면 null 이유와 기존 기본값을 기록한다", async () => {
    // Given
    const fixture = givenAccount("GOOGLE");

    // When
    await fixture.useCase.execute({ userId });

    // Then
    expect(fixture.securityLogRepository.entries).toEqual([
      {
        userId,
        event: SECURITY_EVENT.ACCOUNT_DELETION_REQUESTED,
        ipAddress: AUTH_DEFAULTS.UNKNOWN_IP,
        userAgent: AUTH_DEFAULTS.UNKNOWN_USER_AGENT,
        metadata: {
          reason: null,
          gracePeriodDays: ACCOUNT_DELETION.GRACE_PERIOD_DAYS,
          providers: ["GOOGLE"],
        },
      },
    ]);
  });

  it.each([
    {
      description: "입력 비밀번호 누락",
      inputPassword: undefined,
      storedPassword: `digest:${password}`,
      errorCode: ErrorCode.USER_0612,
    },
    {
      description: "입력 비밀번호가 빈 문자열",
      inputPassword: "",
      storedPassword: `digest:${password}`,
      errorCode: ErrorCode.USER_0612,
    },
    {
      description: "입력 비밀번호 불일치",
      inputPassword: "WrongPassword1!",
      storedPassword: `digest:${password}`,
      errorCode: ErrorCode.USER_0602,
    },
    {
      description: "Credential 해시 부재",
      inputPassword: password,
      storedPassword: null,
      errorCode: ErrorCode.USER_0602,
    },
  ])(
    "$description이면 계정·세션·캐시를 변경하지 않는다",
    async ({ inputPassword, storedPassword, errorCode }) => {
      // Given
      const fixture = givenAccount();
      const account = fixture.accountRepository.accounts[0];
      if (account === undefined) throw new Error("Credential fixture가 없습니다.");
      account.password = storedPassword;

      // When
      const pending = fixture.useCase.execute({ userId, password: inputPassword });

      // Then
      await expect(pending).rejects.toMatchObject({ errorCode });
      expect(fixture.userRepository.users.get(userId)?.deletedAt).toBeNull();
      expect(fixture.sessionRepository.revocationReasons.size).toBe(0);
      expect(fixture.cacheService.sessionIds.size).toBe(3);
      expect(fixture.cacheService.userIds.has(userId)).toBe(true);
      expect(fixture.securityLogRepository.entries).toEqual([]);
    },
  );

  it.each(["존재하지 않는", "이미 탈퇴한"])(
    "%s 사용자는 세션과 캐시를 변경하지 않는다",
    async (scenario) => {
      // Given
      const fixture = givenAccount();
      if (scenario === "존재하지 않는") fixture.userRepository.users.clear();
      else await fixture.userRepository.softDelete(userId, currentTime);

      // When
      const pending = fixture.useCase.execute({ userId, password });

      // Then
      await expect(pending).rejects.toMatchObject({
        errorCode: scenario === "존재하지 않는" ? ErrorCode.USER_0601 : ErrorCode.USER_0606,
      });
      expect(fixture.sessionRepository.revocationReasons.size).toBe(0);
      expect(fixture.cacheService.userIds.has(userId)).toBe(true);
      expect(fixture.securityLogRepository.entries).toEqual([]);
    },
  );

  it("저장 경계가 실패하면 오류를 전파하고 커밋 후 캐시 무효화를 실행하지 않는다", async () => {
    // Given
    const fixture = givenAccount("GOOGLE");
    vi.spyOn(fixture.securityLogRepository, "create").mockRejectedValueOnce(
      new Error("Audit write failed"),
    );

    // When
    const pending = fixture.useCase.execute({ userId });

    // Then
    await expect(pending).rejects.toThrow("Audit write failed");
    expect(fixture.cacheService.sessionIds.size).toBe(3);
    expect(fixture.cacheService.userIds.has(userId)).toBe(true);
  });
});
