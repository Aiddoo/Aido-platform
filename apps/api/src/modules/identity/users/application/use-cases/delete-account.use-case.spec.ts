import { ErrorCode } from "@aido/api/errors";
import { ACCOUNT_DELETION, REVOKE_REASON, SECURITY_EVENT } from "@aido/api/vocabulary";

import type { LinkedAccountRecord } from "#api/modules/identity/linked-accounts/application/ports/linked-accounts.repository.port";
import type { User } from "#api/modules/identity/users/domain/user.aggregate";
import { InMemoryLinkedAccountsRepository } from "#test/doubles/identity/in-memory-linked-accounts.repository";
import { InMemorySecurityLogRepository } from "#test/doubles/identity/in-memory-security-log.repository";
import { InMemorySessionRepository } from "#test/doubles/identity/in-memory-session.repository";
import { InMemoryUserRepository } from "#test/doubles/identity/in-memory-user.repository";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { createLinkedAccountFixture } from "#test/fixtures/identity/auth-credential.fixture";
import {
  AUTH_FIXTURE_NOW,
  AUTH_FIXTURE_USER_ID,
  createSessionFixture,
  createUserFixture,
} from "#test/fixtures/identity/session.fixture";
import {
  StubAccountLifecycleCache,
  StubAccountPasswordVerifier,
} from "#test/mocks/ports/account-lifecycle.stub";
import { StubSessionPushDeviceReleaser } from "#test/mocks/ports/auth-session.stub";

import { type AccountProvider } from "../../../linked-accounts/domain/linked-accounts.constants.js";
import { REQUEST_ORIGIN_DEFAULTS } from "../../../shared/domain/request-metadata.constants.js";
import { UserLogEvent } from "../users.log-events.js";
import { DeleteAccountUseCase } from "./delete-account.use-case.js";

const userId = AUTH_FIXTURE_USER_ID;
const password = "CorrectPassword1!";
const allSessionIds = ["my-session-1", "my-session-2", "expired-session", "other-session"];

function accountOf(provider: AccountProvider): LinkedAccountRecord {
  return createLinkedAccountFixture({
    provider,
    password: provider === "CREDENTIAL" ? `digest:${password}` : null,
  });
}

class FailingSecurityLogRepository extends InMemorySecurityLogRepository {
  override async create(): Promise<void> {
    throw new Error("Audit write failed");
  }
}

describe("DeleteAccount — 계정 탈퇴와 모든 기기의 접근 종료", () => {
  function given(
    options: {
      readonly accounts?: readonly LinkedAccountRecord[];
      readonly users?: readonly User[];
      readonly securityLogRepository?: InMemorySecurityLogRepository;
    } = {},
  ) {
    const userRepository = new InMemoryUserRepository(options.users ?? [createUserFixture()]);
    const accountRepository = new InMemoryLinkedAccountsRepository(
      options.accounts ?? [accountOf("CREDENTIAL")],
    );
    const sessionRepository = new InMemorySessionRepository([
      createSessionFixture({ id: "my-session-1" }),
      createSessionFixture({ id: "my-session-2" }),
      createSessionFixture({
        id: "expired-session",
        expiresAt: AUTH_FIXTURE_NOW.subtract({ milliseconds: 1 }),
      }),
      createSessionFixture({ id: "other-session", userId: "other-user" }),
    ]);
    const cacheService = new StubAccountLifecycleCache(allSessionIds, [userId, "other-user"]);
    const securityLogRepository =
      options.securityLogRepository ?? new InMemorySecurityLogRepository();
    const passwordService = new StubAccountPasswordVerifier();
    const pushDevices = new StubSessionPushDeviceReleaser();
    const logger = new SilentLogger();
    const useCase = new DeleteAccountUseCase({
      clock: new FixedClock(AUTH_FIXTURE_NOW),
      pushDevices,
      userRepository,
      accountRepository,
      sessionRepository,
      cacheService,
      userProfileCache: cacheService,
      securityLogRepository,
      passwordService,
      logger,
      unitOfWork: new ImmediateUnitOfWork(),
    });
    return {
      useCase,
      userRepository,
      sessionRepository,
      cacheService,
      securityLogRepository,
      passwordService,
      pushDevices,
      logger,
    };
  }

  it.each(["CREDENTIAL", "GOOGLE"] as const)(
    "%s 계정의 탈퇴 시 모든 세션과 내 프로필 캐시를 비우고 보안 기록을 남긴다",
    async (provider) => {
      // Given
      const fixture = given({ accounts: [accountOf(provider)] });
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
        deletedAt: "2026-11-10T00:00:00.000Z",
        gracePeriodDays: ACCOUNT_DELETION.GRACE_PERIOD_DAYS,
      });
      expect(fixture.userRepository.stored(userId)).toEqual(
        expect.objectContaining({ status: "SUSPENDED", deletedAt: AUTH_FIXTURE_NOW }),
      );
      expect(fixture.sessionRepository.revocationReasons).toEqual(
        new Map([
          ["my-session-1", REVOKE_REASON.ACCOUNT_DELETION],
          ["my-session-2", REVOKE_REASON.ACCOUNT_DELETION],
          ["expired-session", REVOKE_REASON.ACCOUNT_DELETION],
        ]),
      );
      expect(fixture.cacheService.sessionIds).toEqual(new Set(["other-session"]));
      expect(fixture.cacheService.userIds).toEqual(new Set(["other-user"]));
      expect(fixture.pushDevices.releasedSessionIds).toEqual([
        "my-session-1",
        "my-session-2",
        "expired-session",
      ]);
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
      // 비밀번호·탈퇴 이유·IP가 운영 로그에 남지 않아야 한다
      expect(fixture.logger.messages).toEqual([
        { event: UserLogEvent.ACCOUNT_DELETION_REQUESTED, userId },
      ]);
    },
  );

  it("탈퇴 이유와 요청 정보가 없으면 null 이유와 기존 기본값을 기록한다", async () => {
    // Given
    const fixture = given({ accounts: [accountOf("GOOGLE")] });

    // When
    await fixture.useCase.execute({ userId });

    // Then
    expect(fixture.securityLogRepository.entries).toEqual([
      {
        userId,
        event: SECURITY_EVENT.ACCOUNT_DELETION_REQUESTED,
        ipAddress: REQUEST_ORIGIN_DEFAULTS.UNKNOWN_IP,
        userAgent: REQUEST_ORIGIN_DEFAULTS.UNKNOWN_USER_AGENT,
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
    "$description: 계정·세션·캐시를 변경하지 않는다",
    async ({ inputPassword, storedPassword, errorCode }) => {
      // Given
      const fixture = given({
        accounts: [createLinkedAccountFixture({ password: storedPassword })],
      });

      // When
      const pending = fixture.useCase.execute({ userId, password: inputPassword });

      // Then
      await expect(pending).rejects.toMatchObject({ errorCode });
      expect(fixture.userRepository.stored(userId)?.deletedAt).toBeNull();
      expect(fixture.sessionRepository.revocationReasons.size).toBe(0);
      expect(fixture.cacheService.sessionIds).toEqual(new Set(allSessionIds));
      expect(fixture.cacheService.userIds.has(userId)).toBe(true);
      expect(fixture.securityLogRepository.entries).toEqual([]);
    },
  );

  it.each([
    { scenario: "존재하지 않는", users: [], errorCode: ErrorCode.USER_0601 },
    {
      scenario: "이미 탈퇴한",
      users: [
        createUserFixture({
          status: "SUSPENDED",
          deletedAt: AUTH_FIXTURE_NOW.subtract({ hours: 24 }),
        }),
      ],
      errorCode: ErrorCode.USER_0606,
    },
  ])("$scenario 사용자는 세션과 캐시를 변경하지 않는다", async ({ users, errorCode }) => {
    // Given
    const fixture = given({ users });

    // When
    const pending = fixture.useCase.execute({ userId, password });

    // Then
    await expect(pending).rejects.toMatchObject({ errorCode });
    expect(fixture.sessionRepository.revocationReasons.size).toBe(0);
    expect(fixture.cacheService.userIds.has(userId)).toBe(true);
    expect(fixture.securityLogRepository.entries).toEqual([]);
  });

  it("저장 경계가 실패하면 오류를 전파하고 커밋 후 캐시 무효화를 실행하지 않는다", async () => {
    // Given
    const fixture = given({
      accounts: [accountOf("GOOGLE")],
      securityLogRepository: new FailingSecurityLogRepository(),
    });

    // When
    const pending = fixture.useCase.execute({ userId });

    // Then
    await expect(pending).rejects.toThrow("Audit write failed");
    expect(fixture.cacheService.sessionIds).toEqual(new Set(allSessionIds));
    expect(fixture.cacheService.userIds.has(userId)).toBe(true);
    expect(fixture.pushDevices.releasedSessionIds).toEqual([]);
  });
});
