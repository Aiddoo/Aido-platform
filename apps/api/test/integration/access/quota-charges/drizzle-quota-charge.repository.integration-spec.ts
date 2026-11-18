import { QuotaChargeId } from "#api/modules/access/quota-charges/domain/quota-charge-id.vo";
import { DrizzleQuotaChargeRepository } from "#api/modules/access/quota-charges/infrastructure/persistence/drizzle-quota-charge.repository";
import { user } from "#api/platform/database/schema/index";
import { describeQuotaChargeRepositoryContract } from "#test/contracts/access/quota-charge-repository.contract";
import {
  ACCESS_FIXTURE_OTHER_USER_ID,
  ACCESS_FIXTURE_USER_ID,
} from "#test/fixtures/access/access-user.fixture";
import { createQuotaChargeFixture } from "#test/fixtures/access/quota-charge.fixture";
import { createUserRowFixture } from "#test/fixtures/identity/user-row.fixture";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

describe("DrizzleQuotaChargeRepository (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;

  beforeAll(async () => {
    database = new TestDatabase();
    client = await database.start();
  });

  beforeEach(async () => {
    await database.cleanup();
    await client
      .insert(user)
      .values([
        createUserRowFixture({ id: ACCESS_FIXTURE_USER_ID }),
        createUserRowFixture({ id: ACCESS_FIXTURE_OTHER_USER_ID }),
      ]);
  });

  afterAll(async () => {
    await database.stop();
  });

  function createRepository(): DrizzleQuotaChargeRepository {
    const { transactionHost } = createDatabaseTransactionFixture(client);
    return new DrizzleQuotaChargeRepository(transactionHost);
  }

  describeQuotaChargeRepositoryContract(async () => createRepository());

  it("시각은 ms 3자리 UTC로 저장하고 같은 Instant로 읽는다", async () => {
    // Given
    const repository = createRepository();
    const createdAt = Temporal.Instant.from("2027-01-08T12:00:00.123Z");
    const charge = createQuotaChargeFixture({
      id: QuotaChargeId.generate().value,
      createdAt,
      updatedAt: createdAt.add({ milliseconds: 1 }),
    });

    // When
    await repository.save(charge);
    const found = await repository.findById(charge.id);

    // Then
    expect(found?.toPrimitives().createdAt.toString()).toBe("2027-01-08T12:00:00.123Z");
    expect(found?.toPrimitives().updatedAt.toString()).toBe("2027-01-08T12:00:00.124Z");
  });
});
