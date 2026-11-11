import { DrizzlePlanApplicationRepository } from "#api/modules/voice/action-plans/infrastructure/persistence/drizzle-plan-application.repository";
import { user } from "#api/platform/database/schema/index";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { describePlanApplicationRepositoryContract } from "#test/contracts/voice/plan-application-repository.contract";
import { UserFixture } from "#test/fixtures/index";
import {
  createPlanApplicationFixture,
  PLAN_APPLICATION_FIXTURE_OTHER_USER_ID,
  PLAN_APPLICATION_FIXTURE_USER_ID,
} from "#test/fixtures/voice/plan-application.fixture";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

describe("DrizzlePlanApplicationRepository (실제 PostgreSQL)", () => {
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
        UserFixture.create({ id: PLAN_APPLICATION_FIXTURE_USER_ID }),
        UserFixture.create({ id: PLAN_APPLICATION_FIXTURE_OTHER_USER_ID }),
      ]);
  });

  afterAll(async () => {
    await database.stop();
  });

  function createRepository(): DrizzlePlanApplicationRepository {
    const { txHost } = createDatabaseTransactionFixture(client);
    return new DrizzlePlanApplicationRepository(txHost);
  }

  describePlanApplicationRepositoryContract(async () => createRepository());

  it("만든 시각은 ms 3자리 UTC로 저장하고 같은 Instant로 읽는다", async () => {
    // Given
    const repository = createRepository();
    const application = createPlanApplicationFixture({
      createdAt: Temporal.Instant.from("2027-01-08T12:00:00.123Z"),
    });

    // When
    await repository.save(application);
    const found = await repository.findByIdempotencyKey(
      UserId.reconstitute(PLAN_APPLICATION_FIXTURE_USER_ID),
      "apply-key-1",
    );

    // Then
    expect(found?.toPrimitives()).toEqual(application.toPrimitives());
  });
});
