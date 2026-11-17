import { Verification } from "#api/modules/identity/verifications/domain/verification.aggregate";
import { DrizzleVerificationRepository } from "#api/modules/identity/verifications/infrastructure/persistence/drizzle-verification.repository";
import { user } from "#api/platform/database/schema/index";
import { describeVerificationRepositoryContract } from "#test/contracts/identity/verification-repository.contract";
import {
  AUTH_FIXTURE_NOW,
  AUTH_FIXTURE_OTHER_USER_ID,
  AUTH_FIXTURE_USER_ID,
} from "#test/fixtures/identity/session.fixture";
import { UserFixture } from "#test/fixtures/index";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

describe("DrizzleVerificationRepository (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;

  beforeAll(async () => {
    database = new TestDatabase();
    client = await database.start();
  });

  beforeEach(async () => {
    await database.cleanup();
    await client.insert(user).values([
      UserFixture.create({
        id: AUTH_FIXTURE_USER_ID,
        email: "owner@example.com",
        userTag: "AUTHOWN1",
      }),
      UserFixture.create({
        id: AUTH_FIXTURE_OTHER_USER_ID,
        email: "other@example.com",
        userTag: "AUTHOTH1",
      }),
    ]);
  });

  afterAll(async () => {
    await database.stop();
  });

  function createRepository(): DrizzleVerificationRepository {
    const { transactionHost } = createDatabaseTransactionFixture(client);
    return new DrizzleVerificationRepository(transactionHost, client);
  }

  describeVerificationRepositoryContract(async () => createRepository());

  it("시도 횟수 증가는 바깥 트랜잭션이 롤백돼도 남는다", async () => {
    // Given
    const { transactionHost, uow } = createDatabaseTransactionFixture(client);
    const repository = new DrizzleVerificationRepository(transactionHost, client);
    const verification = Verification.create({
      id: await repository.nextId(),
      userId: AUTH_FIXTURE_USER_ID,
      type: "EMAIL_VERIFY",
      tokenHash: "digest:123456",
      now: AUTH_FIXTURE_NOW,
    });
    await repository.save(verification);
    const failure = new Error("후속 쓰기 실패");

    // When
    const outcome = uow.run(async () => {
      await repository.saveFailedAttempt(verification);
      throw failure;
    });

    // Then
    await expect(outcome).rejects.toBe(failure);
    const found = await repository.findValidByUserIdAndType(
      verification.userId,
      verification.type,
      AUTH_FIXTURE_NOW,
    );
    expect(found?.toPrimitives().attempts).toBe(1);
  });

  it("시각은 ms 3자리로 저장하고 같은 Instant로 읽는다", async () => {
    // Given
    const repository = createRepository();
    const createdAt = Temporal.Instant.from("2027-01-08T12:00:00.123Z");
    const verification = Verification.create({
      id: await repository.nextId(),
      userId: AUTH_FIXTURE_USER_ID,
      type: "EMAIL_VERIFY",
      tokenHash: "digest:123456",
      now: createdAt,
    });

    // When
    await repository.save(verification);
    const found = await repository.findValidByUserIdAndType(
      verification.userId,
      verification.type,
      createdAt,
    );

    // Then
    expect(found?.toPrimitives()).toEqual(verification.toPrimitives());
  });
});
