import { DrizzleSubscriptionRepository } from "#api/modules/billing/subscriptions/infrastructure/persistence/drizzle-subscription.repository";
import { user } from "#api/platform/database/schema/index";
import { describeSubscriptionRepositoryContract } from "#test/contracts/billing/subscription-repository.contract";
import {
  createSubscriptionFixture,
  SUBSCRIPTION_FIXTURE_OTHER_USER_ID,
  SUBSCRIPTION_FIXTURE_USER_ID,
} from "#test/fixtures/billing/subscription.fixture";
import { UserFixture } from "#test/fixtures/index";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

describe("DrizzleSubscriptionRepository (실제 PostgreSQL)", () => {
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
        id: SUBSCRIPTION_FIXTURE_USER_ID,
        email: "owner@example.com",
        userTag: "BILLOWN1",
        revenueCatUserId: "owner-alias",
      }),
      UserFixture.create({
        id: SUBSCRIPTION_FIXTURE_OTHER_USER_ID,
        email: "other@example.com",
        userTag: "BILLOTH1",
      }),
    ]);
  });

  afterAll(async () => {
    await database.stop();
  });

  function createRepository(): DrizzleSubscriptionRepository {
    const { txHost } = createDatabaseTransactionFixture(client);
    return new DrizzleSubscriptionRepository(txHost);
  }

  describeSubscriptionRepositoryContract(async () => createRepository());

  it("시각은 ms 3자리로 저장하고 같은 Instant로 읽는다", async () => {
    // Given
    const repository = createRepository();
    const expiresAt = Temporal.Instant.from("2027-01-08T12:00:00.123Z");
    const subscription = createSubscriptionFixture({
      id: (await repository.nextId()).value,
      expiresAt,
      updatedAt: expiresAt.add({ seconds: 5 }),
    });

    // When
    await repository.save(subscription);
    const found = await repository.findByStoreSubscriptionId(subscription.storeSubscriptionId);

    // Then
    expect(found?.toPrimitives()).toEqual(subscription.toPrimitives());
  });
});
