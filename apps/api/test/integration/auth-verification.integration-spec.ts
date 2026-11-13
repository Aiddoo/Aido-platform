import type { TestingModule } from "@nestjs/testing";
import { sql } from "drizzle-orm";
import { vi } from "vitest";

import { ConsumeVerificationCodeUseCase } from "#api/modules/identity/auth/application/use-cases/consume-verification-code.use-case";
import { ResetPasswordUseCase } from "#api/modules/identity/auth/application/use-cases/reset-password.use-case";
import { VerificationId } from "#api/modules/identity/auth/domain/verification-id.vo";
import { Argon2PasswordHasherAdapter } from "#api/modules/identity/auth/infrastructure/adapters/argon2-password-hasher.adapter";
import { NodeVerificationCodeSecurityAdapter } from "#api/modules/identity/auth/infrastructure/adapters/node-verification-code-security.adapter";
import { DrizzleAccountRepository } from "#api/modules/identity/auth/infrastructure/persistence/drizzle-account.repository";
import { DrizzleVerificationRepository } from "#api/modules/identity/auth/infrastructure/persistence/drizzle-verification.repository";
import { user as userTable, verification } from "#api/platform/database/schema/index";
import { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { createEntityId } from "#api/shared/domain/model/entity-id";
import { UserFixture, VerificationFixture } from "#test/fixtures/index";
import { FakeEmailService } from "#test/mocks/fake-email.service";
import { createTestClient } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

import { createAuthTestModule } from "./helpers/auth-test-module.factory.js";

const at = new Date("2026-12-31T23:59:00.000Z");
const atInstant = Temporal.Instant.fromEpochMilliseconds(at.getTime());
const expiresAt = Temporal.Instant.from("2027-01-01T00:09:00.000Z");
const code = "123456";
const security = new NodeVerificationCodeSecurityAdapter();
const digest = security.hash(code);

describe("인증 소비와 credential 저장 (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;
  let module: TestingModule;
  let repository: DrizzleVerificationRepository;
  let accountRepository: DrizzleAccountRepository;
  let consumeCode: ConsumeVerificationCodeUseCase;
  let passwordService: Argon2PasswordHasherAdapter;
  let resetPassword: ResetPasswordUseCase;
  let unitOfWork: UnitOfWorkPort;
  let userId: string;
  const email = "verification-owner@example.com";

  beforeAll(async () => {
    database = new TestDatabase({ createClient: (url) => createTestClient(url, { max: 6 }) });
    client = await database.start();
    module = await createAuthTestModule(client, new FakeEmailService());
    repository = module.get(DrizzleVerificationRepository);
    accountRepository = module.get(DrizzleAccountRepository);
    consumeCode = module.get(ConsumeVerificationCodeUseCase);
    passwordService = module.get(Argon2PasswordHasherAdapter);
    resetPassword = module.get(ResetPasswordUseCase);
    unitOfWork = module.get(UnitOfWorkPort);
  });

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(at);
    await database.cleanup();
    const user = UserFixture.create({
      id: createEntityId(),
      email,
      userTag: "OTPTEST1",
      createdAt: atInstant,
      updatedAt: atInstant,
    });
    await client.insert(userTable).values(user);
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
      createdAt: atInstant,
      ...overrides,
    });
    await client.insert(verification).values(fixture);
    return fixture;
  }

  async function readVerification(id: number) {
    return client.query.verification.findFirst({ where: { id } });
  }

  async function competeForRow<T>(
    table: "Verification" | "Account",
    id: number,
    start: () => Array<Promise<T>>,
  ) {
    const locked = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const holdingLock = client.transaction(async (transaction) => {
      const lock =
        table === "Verification"
          ? sql`SELECT "id" FROM "Verification" WHERE "id" = ${id} FOR UPDATE`
          : sql`SELECT "id" FROM "Account" WHERE "id" = ${id} FOR UPDATE`;
      await transaction.execute(lock);
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
          const waiting = await client.execute<{ count: number }>(sql`
            SELECT count(*)::int AS count FROM pg_stat_activity
            WHERE datname = current_database() AND wait_event_type = 'Lock'
              AND query ILIKE '%UPDATE%' AND query LIKE ${`%${table}%`}
          `);
          expect(waiting.rows[0]?.count).toBe(2);
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
      UserId.reconstitute(userId),
      await passwordService.hash("OriginalPassword123!"),
    );
    const verification = await givenVerification();
    const nextPasswords = ["FirstNewPassword123!", "SecondNewPassword123!"];

    // When
    const results = await competeForRow("Verification", verification.id, () =>
      nextPasswords.map((newPassword) => resetPassword.execute({ email, code, newPassword })),
    );

    // Then
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected");
    expect(rejected?.reason).toMatchObject({ errorCode: "VERIFY_0751" });
    const account = await accountRepository.findByUserIdAndProvider(
      UserId.reconstitute(userId),
      "CREDENTIAL",
    );
    if (account?.password === null || account?.password === undefined) {
      throw new Error("성공한 요청의 credential 비밀번호가 저장되지 않았습니다.");
    }
    const passwordHash = account.password;
    const matches = await Promise.all(
      nextPasswords.map((password) => passwordService.verify(passwordHash, password)),
    );
    expect(matches).toEqual(results.map((result) => result.status === "fulfilled"));
    expect((await readVerification(verification.id))?.usedAt).toBeInstanceOf(Temporal.Instant);
    expect(
      await client.query.securityLog.findMany({ where: { event: "PASSWORD_CHANGED" } }),
    ).toHaveLength(1);
  });

  it("소비 후 후속 쓰기가 실패하면 usedAt도 rollback하여 다시 사용할 수 있다", async () => {
    // Given
    const verification = await givenVerification();
    const failure = new Error("후속 쓰기 실패");

    // When
    await expect(
      unitOfWork.run(async () => {
        await consumeCode.execute({ userId, code, type: "PASSWORD_RESET" });
        throw failure;
      }),
    ).rejects.toBe(failure);

    // Then
    expect((await readVerification(verification.id))?.usedAt).toBeNull();
    await expect(
      consumeCode.execute({ userId, code, type: "PASSWORD_RESET" }),
    ).resolves.toBeUndefined();
    expect((await readVerification(verification.id))?.usedAt).toEqual(atInstant);
  });

  it("잘못된 코드의 실패 횟수는 외부 트랜잭션 rollback 후에도 유지한다", async () => {
    // Given
    const verification = await givenVerification();

    // When
    await expect(
      unitOfWork.run(() => consumeCode.execute({ userId, code: "000000", type: "PASSWORD_RESET" })),
    ).rejects.toMatchObject({ errorCode: "VERIFY_0751" });

    // Then
    expect(await readVerification(verification.id)).toMatchObject({ attempts: 1, usedAt: null });
  });

  it("병렬 실패 횟수 증가는 독립 커밋으로 누락 없이 누적한다", async () => {
    // Given
    const verification = await givenVerification();

    // When
    const results = await competeForRow("Verification", verification.id, () => [
      unitOfWork.run(() => consumeCode.execute({ userId, code: "000000", type: "PASSWORD_RESET" })),
      unitOfWork.run(() => consumeCode.execute({ userId, code: "000000", type: "PASSWORD_RESET" })),
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
    { description: "만료 시각", overrides: { expiresAt: atInstant }, errorCode: "VERIFY_0751" },
    { description: "시도 한도", overrides: { attempts: 5 }, errorCode: "VERIFY_0754" },
  ])(
    "$description에 도달한 코드는 DB 조건과 서비스에서 소비를 거부한다",
    async ({ overrides, errorCode }) => {
      // Given
      const verification = await givenVerification(overrides);
      const input = {
        id: VerificationId.reconstitute(verification.id),
        userId: UserId.reconstitute(userId),
        type: verification.type,
        tokenHash: digest,
        maxAttempts: 5,
        at: atInstant,
      };

      // When
      expect(await repository.consume(input)).toBe(false);
      await expect(
        consumeCode.execute({ userId, code, type: "PASSWORD_RESET" }),
      ).rejects.toMatchObject({
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
      id: VerificationId.reconstitute(verification.id),
      userId: UserId.reconstitute(userId),
      type: verification.type,
      tokenHash: digest,
      maxAttempts: 5,
      at: atInstant,
    };

    // When
    expect(await repository.consume({ ...input, userId: UserId.reconstitute("other-user") })).toBe(
      false,
    );
    expect(await repository.consume({ ...input, type: "EMAIL_VERIFY" })).toBe(false);
    expect(await repository.consume({ ...input, tokenHash: security.hash("654321") })).toBe(false);
    expect(await repository.consume({ ...input, maxAttempts: 1 })).toBe(false);
    expect((await readVerification(verification.id))?.usedAt).toBeNull();
    expect(await repository.consume(input)).toBe(true);
    expect(await repository.consume(input)).toBe(false);
  });

  it("느린 로그인 rehash는 먼저 저장된 새 비밀번호를 덮어쓰지 않는다", async () => {
    // Given
    await accountRepository.createCredentialAccount(
      UserId.reconstitute(userId),
      "old-password-hash",
    );
    await accountRepository.updatePassword(UserId.reconstitute(userId), "new-password-hash");

    // When
    const updated = await accountRepository.updatePasswordIfUnchanged(
      UserId.reconstitute(userId),
      "old-password-hash",
      "slow-rehash",
    );

    // Then
    expect(updated).toBe(false);
    expect(
      (await accountRepository.findByUserIdAndProvider(UserId.reconstitute(userId), "CREDENTIAL"))
        ?.password,
    ).toBe("new-password-hash");
  });

  it("같은 기존 해시의 두 rehash 중 하나만 변경하고 실제 승자의 해시를 저장한다", async () => {
    // Given
    await accountRepository.createCredentialAccount(
      UserId.reconstitute(userId),
      "old-password-hash",
    );
    const account = await accountRepository.findByUserIdAndProvider(
      UserId.reconstitute(userId),
      "CREDENTIAL",
    );
    if (account == null) {
      throw new Error("credential 계정이 만들어지지 않았습니다.");
    }

    // When
    const results = await competeForRow("Account", account.id, () => [
      accountRepository.updatePasswordIfUnchanged(
        UserId.reconstitute(userId),
        "old-password-hash",
        "first-rehash",
      ),
      accountRepository.updatePasswordIfUnchanged(
        UserId.reconstitute(userId),
        "old-password-hash",
        "second-rehash",
      ),
    ]);

    // Then
    const updated = results.map((result) => {
      if (result.status === "rejected") {
        throw result.reason;
      }
      return result.value;
    });
    expect(updated.filter(Boolean)).toHaveLength(1);
    expect(
      (await accountRepository.findByUserIdAndProvider(UserId.reconstitute(userId), "CREDENTIAL"))
        ?.password,
    ).toBe(updated[0] ? "first-rehash" : "second-rehash");
  });
});
