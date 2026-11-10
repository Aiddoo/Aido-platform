import { DrizzleOAuthStateRepository } from "#api/modules/identity/auth/infrastructure/persistence/drizzle-oauth-state.repository";
import { oAuthState } from "#api/platform/database/schema/index";
import { EncryptionService } from "#api/platform/encryption/index";
import { describeAuthOAuthStateRepositoryContract } from "#test/contracts/identity/auth-oauth-state-repository.contract";
import { AUTH_FIXTURE_NOW } from "#test/fixtures/identity/auth-session.fixture";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

describe("DrizzleOAuthStateRepository (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;

  beforeAll(async () => {
    database = new TestDatabase();
    client = await database.start();
  });

  beforeEach(async () => {
    await database.cleanup();
  });

  afterAll(async () => {
    await database.stop();
  });

  const encryption = new EncryptionService({
    key: "test-token-encryption-key-minimum-32-characters-long",
    salt: undefined,
  });

  function createRepository(): DrizzleOAuthStateRepository {
    const { txHost } = createDatabaseTransactionFixture(client);
    return new DrizzleOAuthStateRepository(txHost, encryption);
  }

  describeAuthOAuthStateRepositoryContract(async () => createRepository());

  it("교환 토큰은 암호문으로 저장한다", async () => {
    // Given
    const repository = createRepository();
    await repository.create({
      state: "encrypted-state",
      provider: "GOOGLE",
      redirectUri: "aido://auth/callback",
      expiresAt: AUTH_FIXTURE_NOW.add({ minutes: 10 }),
    });
    const created = await repository.findByState("encrypted-state", AUTH_FIXTURE_NOW);
    if (created == null) {
      throw new Error("OAuth state가 없다");
    }

    // When
    await repository.saveExchangeData(created.id.value, {
      exchangeCode: "exchange-code",
      accessToken: "plain-access",
      refreshToken: "plain-refresh",
      userId: "user-id",
      isNewUser: false,
    });
    const [row] = await client.select().from(oAuthState);

    // Then
    expect(row?.accessToken).not.toBe("plain-access");
    expect(row?.refreshToken).not.toBe("plain-refresh");
  });
});
