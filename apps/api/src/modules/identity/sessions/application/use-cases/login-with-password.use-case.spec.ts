import { ErrorCode } from "@aido/api/errors";

import type { LinkedAccounts } from "#api/modules/identity/linked-accounts/domain/linked-accounts.aggregate";
import { SECURITY_EVENT } from "#api/modules/identity/users/domain/users.constants";
import type { ApplicationLogMessage } from "#api/shared/application/ports/application-logger.port";
import { InMemoryLinkedAccountsRepository } from "#test/doubles/identity/in-memory-linked-accounts.repository";
import { STUB_DUMMY_HASH, StubPasswordHasher } from "#test/doubles/identity/stub-auth-credentials";
import type { FixedClock } from "#test/doubles/platform/fixed-clock";
import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import {
  AUTH_CREDENTIAL_NOW,
  AUTH_CREDENTIAL_PASSWORD,
  createAuthCredentialFixture,
} from "#test/fixtures/identity/auth-credential-scenario.fixture";
import { createUserFixture } from "#test/fixtures/identity/session.fixture";

import { LinkedAccountsLogEvent } from "../../../linked-accounts/application/linked-accounts.log-events.js";
import { ChangePasswordUseCase } from "../../../linked-accounts/application/use-cases/change-password.use-case.js";
import { LoginWithPasswordUseCase } from "./login-with-password.use-case.js";

type CredentialFixture = ReturnType<typeof createAuthCredentialFixture>;

// 로그인 뒤 백그라운드 rehash가 끝나는 시점을 테스트가 정한다
class DeferredRehashPasswordHasher extends StubPasswordHasher {
  readonly rehash = Promise.withResolvers<string>();
  #deferred = true;

  constructor(outdatedHash: string) {
    super();
    this.outdatedHashes.add(outdatedHash);
  }

  override async hash(password: string): Promise<string> {
    if (this.#deferred) {
      this.#deferred = false;
      return this.rehash.promise;
    }
    return super.hash(password);
  }
}

// 다음 저장의 결과를 기다린다. 로그인 뒤 rehash 저장은 응답과 따로 끝난다
class SaveObservingAccountRepository extends InMemoryLinkedAccountsRepository {
  #nextSave = Promise.withResolvers<boolean>();

  get nextSave(): Promise<boolean> {
    return this.#nextSave.promise;
  }

  override async save(linkedAccounts: LinkedAccounts): Promise<boolean> {
    const saved = await super.save(linkedAccounts);
    this.#nextSave.resolve(saved);
    this.#nextSave = Promise.withResolvers<boolean>();
    return saved;
  }
}

class ErrorSignalingLogger extends SilentLogger {
  readonly errorLogged = Promise.withResolvers<void>();

  override error(message: ApplicationLogMessage): void {
    super.error(message);
    this.errorLogged.resolve();
  }
}

// 복구를 판정한 뒤 트랜잭션이 열리기 전에 시간이 흘러 유예 경계를 넘는 상황을 만든다
class ClockAdvancingUnitOfWork extends ImmediateUnitOfWork {
  readonly #clock: FixedClock;

  constructor(clock: FixedClock) {
    super();
    this.#clock = clock;
  }

  override run<T>(work: () => Promise<T>): Promise<T> {
    this.#clock.advanceBy({ milliseconds: 2 });
    return super.run(work);
  }
}

// 탈퇴 유예 중 비활성 계정은 권한을 무료로 캐시한다
const FREE_ACCESS_WHILE_DELETED = { status: null, isAdmin: false, resourceBonuses: {} };

async function markDeleted(fixture: CredentialFixture, deletedAt: Temporal.Instant) {
  await fixture.userRepository.save(
    createUserFixture({ ...fixture.user, status: "SUSPENDED", deletedAt }),
  );
}

describe("LoginWithPassword — 이메일 로그인과 계정 보호", () => {
  function given(options: Parameters<typeof createAuthCredentialFixture>[0] = {}) {
    const fixture = createAuthCredentialFixture(options);
    return { ...fixture, useCase: new LoginWithPasswordUseCase(fixture) };
  }

  it("인증된 사용자의 세션·토큰을 발급하고 성공 기록과 프로필을 반환한다", async () => {
    // Given
    const fixture = given();
    const metadata = { ip: "192.0.2.1", userAgent: "Aido-Test" };

    // When
    const result = await fixture.useCase.execute({
      email: fixture.user.email,
      password: AUTH_CREDENTIAL_PASSWORD,
      deviceName: "내 기기",
      metadata,
    });

    // Then
    expect(result).toMatchObject({
      userId: fixture.user.id,
      userTag: fixture.user.userTag,
      name: "사용자",
      profileImage: null,
      accountRestored: false,
      tokens: { expiresIn: 900 },
    });
    expect(fixture.sessionRepository.stored(result.sessionId)).toEqual(
      expect.objectContaining({
        userId: fixture.user.id,
        deviceFingerprint: "내 기기",
        ipAddress: metadata.ip,
        userAgent: metadata.userAgent,
        revokedAt: null,
      }),
    );
    expect(fixture.loginAttemptRepository.attempts).toEqual([
      expect.objectContaining({ email: fixture.user.email, provider: "CREDENTIAL", success: true }),
    ]);
    expect(fixture.securityLogRepository.entries).toEqual([
      {
        userId: fixture.user.id,
        event: SECURITY_EVENT.LOGIN_SUCCESS,
        ipAddress: metadata.ip,
        userAgent: metadata.userAgent,
      },
    ]);
  });

  it.each(["missing", "social", "wrong"] as const)(
    "%s 자격 증명 실패의 사유를 저장하고 세션을 발급하지 않는다",
    async (reason) => {
      // Given
      const fixture = given({ empty: reason === "missing", socialOnly: reason === "social" });
      const expected =
        reason === "missing"
          ? "USER_NOT_FOUND"
          : reason === "social"
            ? "NO_CREDENTIAL_ACCOUNT"
            : "INVALID_PASSWORD";

      // When
      const pending = fixture.useCase.execute({
        email: fixture.user.email,
        password: reason === "wrong" ? "wrong" : AUTH_CREDENTIAL_PASSWORD,
      });

      // Then
      await expect(pending).rejects.toMatchObject({ errorCode: ErrorCode.USER_0602 });
      expect(fixture.loginAttemptRepository.attempts).toEqual([
        expect.objectContaining({
          success: false,
          failureReason: expected,
          attemptedAt: AUTH_CREDENTIAL_NOW,
        }),
      ]);
      expect(fixture.sessionRepository.all).toEqual([]);
    },
  );

  it.each(["missing", "social"] as const)(
    "%s 계정도 고정 hash로 비밀번호를 한 번 확인해 응답 시간이 같다",
    async (reason) => {
      // Given
      const fixture = given({ empty: reason === "missing", socialOnly: reason === "social" });

      // When
      const pending = fixture.useCase.execute({
        email: fixture.user.email,
        password: AUTH_CREDENTIAL_PASSWORD,
      });

      // Then
      await expect(pending).rejects.toMatchObject({ errorCode: ErrorCode.USER_0602 });
      expect(fixture.passwordService.checked).toEqual([
        { hash: STUB_DUMMY_HASH, password: AUTH_CREDENTIAL_PASSWORD },
      ]);
    },
  );

  it("한 곳의 실패로 잠겨도 다른 곳의 본인은 로그인하고 IPv6는 /64 대역 하나를 한 곳으로 센다", async () => {
    // Given
    const fixture = given();
    const login = (password: string, ip: string) =>
      fixture.useCase
        .execute({ email: fixture.user.email, password, metadata: { ip, userAgent: "Aido" } })
        .catch((error: unknown) => error);
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      await login("wrong", `2001:db8:1:2::${attempt}`);
    }

    // When
    const fifthFromBlock = await login("wrong", "2001:db8:1:2:ffff::5");
    const correctFromBlock = await login(AUTH_CREDENTIAL_PASSWORD, "2001:db8:1:2::9");
    const fromOwner = await login(AUTH_CREDENTIAL_PASSWORD, "192.0.2.10");

    // Then
    expect(fifthFromBlock).toMatchObject({ errorCode: ErrorCode.USER_0607 });
    expect(correctFromBlock).toMatchObject({ errorCode: ErrorCode.USER_0607 });
    expect(fromOwner).toMatchObject({ userId: fixture.user.id, accountRestored: false });
  });

  it("여러 곳에 나눈 실패도 이메일마다 20번이면 새 곳의 로그인까지 잠근다", async () => {
    // Given
    const fixture = given();
    const login = (password: string, ip: string) =>
      fixture.useCase
        .execute({ email: fixture.user.email, password, metadata: { ip, userAgent: "Aido" } })
        .catch((error: unknown) => error);
    const failures: unknown[] = [];
    for (const ip of ["198.51.100.1", "198.51.100.2", "198.51.100.3", "198.51.100.4"]) {
      for (let attempt = 1; attempt <= 4; attempt += 1) {
        failures.push(await login("wrong", ip));
      }
    }
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      failures.push(await login("wrong", "198.51.100.5"));
    }

    // When
    const twentiethFailure = await login("wrong", "198.51.100.6");
    const fromOwner = await login(AUTH_CREDENTIAL_PASSWORD, "192.0.2.10");

    // Then
    expect(failures).toHaveLength(19);
    for (const failure of failures) {
      expect(failure).toMatchObject({ errorCode: ErrorCode.USER_0602 });
    }
    expect(twentiethFailure).toMatchObject({ errorCode: ErrorCode.USER_0607 });
    expect(fromOwner).toMatchObject({ errorCode: ErrorCode.USER_0607 });
  });

  it("다섯 번째 비밀번호 실패부터 잠그고 30분이 지난 실패는 잠금 계산에서 제외한다", async () => {
    // Given
    const fixture = given();
    const login = (password: string) =>
      fixture.useCase.execute({ email: fixture.user.email, password });
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      await expect(login("wrong")).rejects.toMatchObject({ errorCode: ErrorCode.USER_0602 });
    }

    // When
    const fifthFailure = await login("wrong").catch((error: unknown) => error);
    const lockedLogin = await login(AUTH_CREDENTIAL_PASSWORD).catch((error: unknown) => error);
    fixture.clock.advanceBy({ minutes: 31 });
    const afterLockout = await login(AUTH_CREDENTIAL_PASSWORD);

    // Then
    expect(fifthFailure).toMatchObject({ errorCode: ErrorCode.USER_0607 });
    expect(lockedLogin).toMatchObject({ errorCode: ErrorCode.USER_0607 });
    expect(afterLockout.accountRestored).toBe(false);
    // 잠긴 동안의 시도는 비밀번호를 확인하거나 시도로 기록하지 않는다
    expect(fixture.passwordService.checked).toHaveLength(6);
    expect(fixture.loginAttemptRepository.attempts.map((attempt) => attempt.success)).toEqual([
      false,
      false,
      false,
      false,
      false,
      true,
    ]);
    expect(fixture.securityLogRepository.entries).toEqual([
      expect.objectContaining({
        event: SECURITY_EVENT.ACCOUNT_LOCKED,
        metadata: { email: fixture.user.email, recentFailures: 5, recentSourceFailures: 5 },
      }),
      expect.objectContaining({ event: SECURITY_EVENT.LOGIN_SUCCESS }),
    ]);
  });

  it.each([
    { status: "PENDING_VERIFY", errorCode: ErrorCode.EMAIL_0503 },
    { status: "LOCKED", errorCode: ErrorCode.USER_0607 },
    { status: "SUSPENDED", errorCode: ErrorCode.USER_0605 },
  ] as const)(
    "$status 계정은 올바른 비밀번호여도 세션을 발급하지 않는다",
    async ({ status, errorCode }) => {
      // Given
      const fixture = given({ pending: status === "PENDING_VERIFY" });
      await fixture.userRepository.save(createUserFixture({ ...fixture.user, status }));

      // When
      const pending = fixture.useCase.execute({
        email: fixture.user.email,
        password: AUTH_CREDENTIAL_PASSWORD,
      });

      // Then
      await expect(pending).rejects.toMatchObject({ errorCode });
      expect(fixture.sessionRepository.all).toEqual([]);
      expect(fixture.loginAttemptRepository.attempts).toEqual([]);
    },
  );

  it.each([
    { crossesBoundary: false, deletedAt: "2026-10-12T00:00:00.000Z" },
    // 판정 시각에는 유예 30일보다 1ms 짧고 트랜잭션 안의 시각에는 유예를 넘는다
    { crossesBoundary: true, deletedAt: "2026-10-11T00:00:00.001Z" },
  ])(
    "복구 승인 후 처리 중 유예 경계 통과=$crossesBoundary여도 같은 판정 시각으로 복구한다",
    async ({ crossesBoundary, deletedAt }) => {
      // Given
      const fixture = createAuthCredentialFixture();
      await markDeleted(fixture, Temporal.Instant.from(deletedAt));
      fixture.cacheService.userIds.add(fixture.user.id);
      fixture.entitlementCache.entries.set(fixture.user.id, FREE_ACCESS_WHILE_DELETED);
      const useCase = new LoginWithPasswordUseCase({
        ...fixture,
        unitOfWork: crossesBoundary
          ? new ClockAdvancingUnitOfWork(fixture.clock)
          : fixture.unitOfWork,
      });

      // When
      const result = await useCase.execute({
        email: fixture.user.email,
        password: AUTH_CREDENTIAL_PASSWORD,
      });

      // Then
      expect(result.accountRestored).toBe(true);
      expect(fixture.userRepository.stored(fixture.user.id)).toEqual(
        expect.objectContaining({ status: "ACTIVE", deletedAt: null }),
      );
      expect(fixture.cacheService.userIds.has(fixture.user.id)).toBe(false);
      expect(fixture.entitlementCache.entries.has(fixture.user.id)).toBe(false);
      expect(fixture.securityLogRepository.entries).toContainEqual(
        expect.objectContaining({
          event: SECURITY_EVENT.ACCOUNT_RESTORED,
          metadata: { deletedAt, restoredAt: "2026-11-10T00:00:00.000Z" },
        }),
      );
    },
  );

  it("복구 유예가 끝난 계정은 저장·발급 없이 USER_0606으로 거부한다", async () => {
    // Given
    const fixture = given();
    await markDeleted(fixture, AUTH_CREDENTIAL_NOW.subtract({ hours: 24 * 31 }));

    // When
    const pending = fixture.useCase.execute({
      email: fixture.user.email,
      password: AUTH_CREDENTIAL_PASSWORD,
    });

    // Then
    await expect(pending).rejects.toMatchObject({ errorCode: ErrorCode.USER_0606 });
    expect(fixture.userRepository.stored(fixture.user.id)?.status).toBe("SUSPENDED");
    expect(fixture.sessionRepository.all).toEqual([]);
    expect(fixture.securityLogRepository.entries).toEqual([]);
  });

  it("진행 중인 rehash보다 뒤에 변경한 비밀번호를 CAS로 보존한다", async () => {
    // Given
    const fixture = createAuthCredentialFixture();
    const passwordService = new DeferredRehashPasswordHasher(`digest:${AUTH_CREDENTIAL_PASSWORD}`);
    const accountRepository = new SaveObservingAccountRepository(fixture.accountRepository.all);
    const dependencies = { ...fixture, passwordService, accountRepository };
    const login = await new LoginWithPasswordUseCase(dependencies).execute({
      email: fixture.user.email,
      password: AUTH_CREDENTIAL_PASSWORD,
    });

    // When
    await new ChangePasswordUseCase(dependencies).execute({
      userId: fixture.user.id,
      currentPassword: AUTH_CREDENTIAL_PASSWORD,
      newPassword: "new-password",
      currentSessionId: login.sessionId,
    });
    const rehashSettled = accountRepository.nextSave;
    passwordService.rehash.resolve("upgraded:old-password");
    const rehashSaved = await rehashSettled;

    // Then
    expect(rehashSaved).toBe(false);
    expect(accountRepository.all.map((account) => account.password)).toEqual([
      "digest:new-password",
    ]);
    expect(fixture.sessionRepository.stored(login.sessionId)?.revokedAt).toBeNull();
  });

  it("rehash 실패는 성공한 로그인 응답을 바꾸거나 민감한 오류를 기록하지 않는다", async () => {
    // Given
    const fixture = createAuthCredentialFixture();
    const passwordService = new DeferredRehashPasswordHasher(`digest:${AUTH_CREDENTIAL_PASSWORD}`);
    const logger = new ErrorSignalingLogger();
    const useCase = new LoginWithPasswordUseCase({ ...fixture, passwordService, logger });

    // When
    const result = await useCase.execute({
      email: fixture.user.email,
      password: AUTH_CREDENTIAL_PASSWORD,
    });
    passwordService.rehash.reject(new Error("private password payload"));
    await logger.errorLogged.promise;

    // Then
    expect(fixture.sessionRepository.stored(result.sessionId)?.revokedAt).toBeNull();
    expect(fixture.accountRepository.all.map((account) => account.password)).toEqual([
      `digest:${AUTH_CREDENTIAL_PASSWORD}`,
    ]);
    expect(logger.messages).toContainEqual({
      event: LinkedAccountsLogEvent.PASSWORD_REHASH_FAILED,
      userId: fixture.user.id,
      errorType: "Error",
    });
    expect(JSON.stringify(logger.messages)).not.toContain("private password payload");
  });

  it("비밀번호가 그대로면 rehash를 저장하고 로그인 세션을 유지한다", async () => {
    // Given
    const fixture = createAuthCredentialFixture();
    const passwordService = new DeferredRehashPasswordHasher(`digest:${AUTH_CREDENTIAL_PASSWORD}`);
    const accountRepository = new SaveObservingAccountRepository(fixture.accountRepository.all);
    const useCase = new LoginWithPasswordUseCase({
      ...fixture,
      passwordService,
      accountRepository,
    });

    // When
    const result = await useCase.execute({
      email: fixture.user.email,
      password: AUTH_CREDENTIAL_PASSWORD,
    });
    const rehashSettled = accountRepository.nextSave;
    passwordService.rehash.resolve("upgraded:current-password");
    const rehashSaved = await rehashSettled;

    // Then
    expect(rehashSaved).toBe(true);
    expect(accountRepository.all.map((account) => account.password)).toEqual([
      "upgraded:current-password",
    ]);
    expect(fixture.sessionRepository.stored(result.sessionId)?.revokedAt).toBeNull();
  });
});
