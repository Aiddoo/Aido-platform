import { eq } from "drizzle-orm";

import { DrizzleUserSubscriptionProjectionRepository } from "#api/modules/billing/premium-grants/infrastructure/persistence/drizzle-user-subscription-projection.repository";
import { user } from "#api/platform/database/schema/index";
import { instantFromDate } from "#api/shared/domain/time/instant";
import { describeUserSubscriptionProjectionRepositoryContract } from "#test/contracts/billing/user-subscription-projection-repository.contract";
import { UserFixture } from "#test/fixtures/index";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

describe("DrizzleUserSubscriptionProjectionRepository (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;
  let seeded = 0;

  beforeAll(async () => {
    database = new TestDatabase();
    client = await database.start();
  });

  beforeEach(async () => {
    await database.cleanup();
    seeded = 0;
  });

  afterAll(async () => {
    await database.stop();
  });

  describeUserSubscriptionProjectionRepositoryContract(async () => {
    const { txHost } = createDatabaseTransactionFixture(client);
    return {
      repository: new DrizzleUserSubscriptionProjectionRepository(txHost),
      seedUser: async (input) => {
        seeded += 1;
        await client.insert(user).values(
          UserFixture.create({
            id: input.id,
            email: `projection-${seeded}@example.com`,
            userTag: `PROJ${String(seeded).padStart(4, "0")}`,
            subscriptionStatus: input.subscriptionStatus,
            subscriptionExpiresAt:
              input.subscriptionExpiresAt == null
                ? null
                : new Date(input.subscriptionExpiresAt.epochMilliseconds),
            deletedAt: input.deleted === true ? new Date() : null,
          }),
        );
      },
      readProjection: async (userId) => {
        const [row] = await client
          .select({
            subscriptionStatus: user.subscriptionStatus,
            subscriptionExpiresAt: user.subscriptionExpiresAt,
          })
          .from(user)
          .where(eq(user.id, userId));
        if (row == null) {
          return null;
        }
        return {
          subscriptionStatus: row.subscriptionStatus,
          subscriptionExpiresAt:
            row.subscriptionExpiresAt == null ? null : instantFromDate(row.subscriptionExpiresAt),
        };
      },
    };
  });
});
