import { DrizzleNotificationReader } from "#api/modules/notification/inbox/infrastructure/persistence/drizzle-notification.reader";
import { DrizzleNotificationRepository } from "#api/modules/notification/inbox/infrastructure/persistence/drizzle-notification.repository";
import { user } from "#api/platform/database/schema/index";
import { describeNotificationRepositoryContract } from "#test/contracts/notification/notification-repository.contract";
import { UserFixture } from "#test/fixtures/index";
import {
  NOTIFICATION_FIXTURE_ACTOR_ID,
  NOTIFICATION_FIXTURE_OTHER_USER_ID,
  NOTIFICATION_FIXTURE_USER_ID,
} from "#test/fixtures/notification/notification.fixture";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

describe("DrizzleNotificationRepository·Reader (실제 PostgreSQL)", () => {
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
        UserFixture.create({ id: NOTIFICATION_FIXTURE_USER_ID }),
        UserFixture.create({ id: NOTIFICATION_FIXTURE_OTHER_USER_ID }),
        UserFixture.create({ id: NOTIFICATION_FIXTURE_ACTOR_ID }),
      ]);
  });

  afterAll(async () => {
    await database.stop();
  });

  describeNotificationRepositoryContract(async () => {
    const { txHost } = createDatabaseTransactionFixture(client);
    const reader = new DrizzleNotificationReader(txHost);
    return {
      repository: new DrizzleNotificationRepository(txHost),
      inboxReader: reader,
      historyReader: reader,
    };
  });
});
