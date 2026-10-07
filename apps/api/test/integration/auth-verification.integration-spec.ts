import type { TestingModule } from "@nestjs/testing";
import sql from "sql-template-tag";
import { vi } from "vitest";

import { VerificationService } from "#api/modules/identity/application/services/auth/verification.service";
import { ResetPassword } from "#api/modules/identity/application/use-cases/auth/reset-password.use-case";
import { NodeVerificationCodeSecurityAdapter } from "#api/modules/identity/infrastructure/adapters/auth/node-verification-code-security.adapter";
import { PasswordService } from "#api/modules/identity/infrastructure/adapters/auth/password.service";
import { AccountRepository } from "#api/modules/identity/infrastructure/persistence/auth/account.repository";
import { VerificationRepository } from "#api/modules/identity/infrastructure/persistence/auth/verification.repository";
import { decodeRecord, encodeCreate } from "#api/platform/database/database-records";
import { sqlStatement } from "#api/platform/database/database-sql";
import { createEntityId } from "#api/platform/database/database-values";
import { UNIT_OF_WORK, type UnitOfWorkPort } from "#api/shared/application/ports/index";
import { UserFixture, VerificationFixture } from "#test/fixtures/index";
import { FakeEmailService } from "#test/mocks/fake-email.service";
import {
  createTestClient,
  createTestDatabaseService,
  withDatabaseTransaction,
} from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

import { createAuthTestModule } from "./helpers/auth-test-module.factory.js";

const at = new Date("2026-12-31T23:59:00.000Z");
const expiresAt = new Date("2027-01-01T00:09:00.000Z");
const code = "123456";
const security = new NodeVerificationCodeSecurityAdapter();
const digest = security.hash(code);

describe("인증 소비와 credential 저장 (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;
  let module: TestingModule;
  let repository: VerificationRepository;
  let accountRepository: AccountRepository;
  let service: VerificationService;
  let passwordService: PasswordService;
  let resetPassword: ResetPassword;
  let unitOfWork: UnitOfWorkPort;
  let userId: string;
  const email = "verification-owner@example.com";

  beforeAll(async () => {
    database = new TestDatabase({ createClient: (url) => createTestClient(url, { max: 6 }) });
    client = await database.start();
    module = await createAuthTestModule(createTestDatabaseService(client), new FakeEmailService());
    repository = module.get(VerificationRepository);
    accountRepository = module.get(AccountRepository);
    service = module.get(VerificationService);
    passwordService = module.get(PasswordService);
    resetPassword = module.get(ResetPassword);
    unitOfWork = module.get(UNIT_OF_WORK);
  });

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(at);
    await database.cleanup();
    const user = UserFixture.create({
      id: createEntityId(),
      email,
      userTag: "OTPTEST1",
      createdAt: at,
      updatedAt: at,
    });
    await client.orm.public.User.create(encodeCreate("User", user));
    userId = user.id;
  });

  afterEach(() => vi.useRealTimers());

  afterAll(async () => {
    try {
      await module?.close();
    } finally {
      await database?.stop();
    }
  });

  async function givenVerification(
    overrides: Parameters<typeof VerificationFixture.create>[0] = {},
  ) {
    const fixture = VerificationFixture.create({
      userId,
      type: "PASSWORD_RESET",
      token: digest,
      expiresAt,
      createdAt: at,
      ...overrides,
    });
    await client.orm.public.Verification.create(encodeCreate("Verification", fixture));
    return fixture;
  }

  async function readVerification(id: number) {
    return decodeRecord(
      "Verification",
      await client.orm.public.Verification.where((row) => row.id.eq(id)).first(),
    );
  }

  async function competeForRow<T>(
    table: "Verification" | "Account",
    id: number,
    start: () => Array<Promise<T>>,
  ) {
    const locked = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const holdingLock = withDatabaseTransaction(client, async (transaction) => {
      const lock =
        table === "Verification"
          ? sql`SELECT "id" FROM "Verification" WHERE "id" = ${id} FOR UPDATE`
          : sql`SELECT "id" FROM "Account" WHERE "id" = ${id} FOR UPDATE`;
      await transaction.query(
        sqlStatement(transaction, lock).returnsRow({ id: "pg/int4@1" }).build(),
      );
      locked.resolve();
      await release.promise;
    });
    await Promise.race([
      locked.promise,
      holdingLock.then(() => {
        throw new Error("동시 UPDATE 요청 전에 row lock이 해제되었습니다.");
      }),
    ]);
    const outcomes = Promise.allSettled(start());
    try {
      await vi.waitFor(
        async () => {
          const waiting = await client.runtime().query(
            client.raw.sql`
          SELECT count(*)::int AS count FROM pg_stat_activity
          WHERE datname = current_database() AND wait_event_type = 'Lock'
            AND query ILIKE '%UPDATE%' AND query LIKE ${`%${table}%`}
        `
              .returnsRow({ count: "pg/int4@1" })
              .build(),
          );
          expect(waiting[0]?.count).toBe(2);
        },
        { timeout: 5000, interval: 10 },
      );
    } finally {
      release.resolve();
      await holdingLock;
      await outcomes;
    }
    return outcomes;
  }

  it("같은 OTP의 동시 비밀번호 재설정은 하나만 성공하고 승자의 비밀번호와 감사 기록을 저장한다", async () => {
    // Given
    await accountRepository.createCredentialAccount(
      userId,
      await passwordService.hash("OriginalPassword123!"),
    );
    const verification = await givenVerification();
    const nextPasswords = ["FirstNewPassword123!", "SecondNewPassword123!"];

    // When - 실제 두 UPDATE가 같은 인증 행의 lock에서 대기한 뒤 진행한다.
    const results = await competeForRow("Verification", verification.id, () =>
      nextPasswords.map((newPassword) => resetPassword.execute({ email, code, newPassword })),
    );

    // Then
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected");
    expect(rejected?.reason).toMatchObject({ errorCode: "VERIFY_0751" });
    const account = await accountRepository.findByUserIdAndProvider(userId, "CREDENTIAL");
    if (account?.password === null || account?.password === undefined) {
      throw new Error("성공한 요청의 credential 비밀번호가 저장되지 않았습니다.");
    }
    const passwordHash = account.password;
    const matches = await Promise.all(
      nextPasswords.map((password) => passwordService.verify(passwordHash, password)),
    );
    expect(matches).toEqual(results.map((result) => result.status === "fulfilled"));
    expect((await readVerification(verification.id))?.usedAt).toBeInstanceOf(Date);
    expect(
      await client.orm.public.SecurityLog.where((row) => row.event.eq("PASSWORD_CHANGED")).all(),
    ).toHaveLength(1);
  });

  it("소비 후 후속 쓰기가 실패하면 usedAt도 rollback하여 다시 사용할 수 있다", async () => {
    // Given
    const verification = await givenVerification();
    const failure = new Error("후속 쓰기 실패");

    // When
    await expect(
      unitOfWork.run(async () => {
        await service.verifyCode(userId, code, "PASSWORD_RESET");
        throw failure;
      }),
    ).rejects.toBe(failure);

    // Then
    expect((await readVerification(verification.id))?.usedAt).toBeNull();
    await expect(service.verifyCode(userId, code, "PASSWORD_RESET")).resolves.toBe(true);
    expect((await readVerification(verification.id))?.usedAt).toEqual(at);
  });

  it("잘못된 코드의 실패 횟수는 외부 트랜잭션 rollback 후에도 유지한다", async () => {
    // Given
    const verification = await givenVerification();

    // When
    await expect(
      unitOfWork.run(() => service.verifyCode(userId, "000000", "PASSWORD_RESET")),
    ).rejects.toMatchObject({ errorCode: "VERIFY_0751" });

    // Then
    expect(await readVerification(verification.id)).toMatchObject({ attempts: 1, usedAt: null });
  });

  it("병렬 실패 횟수 증가는 독립 커밋으로 누락 없이 누적한다", async () => {
    // Given
    const verification = await givenVerification();

    // When
    const results = await competeForRow("Verification", verification.id, () => [
      unitOfWork.run(() => service.verifyCode(userId, "000000", "PASSWORD_RESET")),
      unitOfWork.run(() => service.verifyCode(userId, "000000", "PASSWORD_RESET")),
    ]);

    // Then
    for (const result of results) {
      expect(result.status).toBe("rejected");
      if (result.status === "rejected") {
        expect(result.reason).toMatchObject({ errorCode: "VERIFY_0751" });
      }
    }
    expect(await readVerification(verification.id)).toMatchObject({ attempts: 2, usedAt: null });
  });

  it.each([
    { description: "만료 시각", overrides: { expiresAt: at }, errorCode: "VERIFY_0751" },
    { description: "시도 한도", overrides: { attempts: 5 }, errorCode: "VERIFY_0754" },
  ])(
    "$description에 도달한 코드는 DB 조건과 서비스에서 소비를 거부한다",
    async ({ overrides, errorCode }) => {
      // Given
      const verification = await givenVerification(overrides);
      const input = {
        id: verification.id,
        userId,
        type: verification.type,
        tokenHash: digest,
        maxAttempts: 5,
        at,
      };

      // When / Then
      expect(await repository.consume(input)).toBe(false);
      await expect(service.verifyCode(userId, code, "PASSWORD_RESET")).rejects.toMatchObject({
        errorCode,
      });
      expect(await readVerification(verification.id)).toMatchObject({
        usedAt: null,
        attempts: verification.attempts,
      });
    },
  );

  it("다른 사용자·용도·해시나 시도 한도가 맞지 않으면 선택한 인증을 소비하지 않는다", async () => {
    // Given
    const verification = await givenVerification({ attempts: 1 });
    const input = {
      id: verification.id,
      userId,
      type: verification.type,
      tokenHash: digest,
      maxAttempts: 5,
      at,
    };

    // When / Then
    expect(await repository.consume({ ...input, userId: "other-user" })).toBe(false);
    expect(await repository.consume({ ...input, type: "EMAIL_VERIFY" })).toBe(false);
    expect(await repository.consume({ ...input, tokenHash: security.hash("654321") })).toBe(false);
    expect(await repository.consume({ ...input, maxAttempts: 1 })).toBe(false);
    expect((await readVerification(verification.id))?.usedAt).toBeNull();
    expect(await repository.consume(input)).toBe(true);
    expect(await repository.consume(input)).toBe(false);
  });

  it("느린 로그인 rehash는 먼저 저장된 새 비밀번호를 덮어쓰지 않는다", async () => {
    // Given
    await accountRepository.createCredentialAccount(userId, "old-password-hash");
    await accountRepository.updatePassword(userId, "new-password-hash");

    // When
    const updated = await accountRepository.updatePasswordIfUnchanged(
      userId,
      "old-password-hash",
      "slow-rehash",
    );

    // Then
    expect(updated).toBe(false);
    expect((await accountRepository.findByUserIdAndProvider(userId, "CREDENTIAL"))?.password).toBe(
      "new-password-hash",
    );
  });

  it("같은 기존 해시의 두 rehash 중 하나만 변경하고 실제 승자의 해시를 저장한다", async () => {
    // Given
    const account = await accountRepository.createCredentialAccount(userId, "old-password-hash");

    // When
    const results = await competeForRow("Account", account.id, () => [
      accountRepository.updatePasswordIfUnchanged(userId, "old-password-hash", "first-rehash"),
      accountRepository.updatePasswordIfUnchanged(userId, "old-password-hash", "second-rehash"),
    ]);

    // Then
    const updated = results.map((result) => {
      if (result.status === "rejected") throw result.reason;
      return result.value;
    });
    expect(updated.filter(Boolean)).toHaveLength(1);
    expect((await accountRepository.findByUserIdAndProvider(userId, "CREDENTIAL"))?.password).toBe(
      updated[0] ? "first-rehash" : "second-rehash",
    );
  });
});
