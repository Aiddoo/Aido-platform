import { DrizzleLinkedAccountsRepository } from "#api/modules/identity/linked-accounts/infrastructure/persistence/drizzle-linked-accounts.repository";
import { account, user } from "#api/platform/database/schema/index";
import { EncryptionService } from "#api/platform/encryption/encryption.service";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { describeLinkedAccountsRepositoryContract } from "#test/contracts/identity/linked-accounts-repository.contract";
import { DateClock } from "#test/doubles/platform/date-clock";
import {
  AUTH_FIXTURE_OTHER_USER_ID,
  AUTH_FIXTURE_USER_ID,
} from "#test/fixtures/identity/session.fixture";
import { UserFixture } from "#test/fixtures/index";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

describe("DrizzleLinkedAccountsRepository (실제 PostgreSQL)", () => {
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

  const encryption = new EncryptionService({
    key: "test-token-encryption-key-minimum-32-characters-long",
    salt: undefined,
  });

  function createRepository(): DrizzleLinkedAccountsRepository {
    const { transactionHost } = createDatabaseTransactionFixture(client);
    return new DrizzleLinkedAccountsRepository(transactionHost, encryption, new DateClock());
  }

  describeLinkedAccountsRepositoryContract(async () => createRepository());

  it("공급자 refresh 토큰은 암호문으로 저장한다", async () => {
    // Given
    const repository = createRepository();

    // When
    await repository.createOAuthAccount({
      userId: UserId.reconstitute(AUTH_FIXTURE_USER_ID),
      provider: "APPLE",
      providerAccountId: "apple-account",
      refreshToken: "plain-refresh",
    });
    const [row] = await client.select().from(account);

    // Then
    expect(row?.refreshToken).not.toBeNull();
    expect(row?.refreshToken).not.toBe("plain-refresh");
  });
});
