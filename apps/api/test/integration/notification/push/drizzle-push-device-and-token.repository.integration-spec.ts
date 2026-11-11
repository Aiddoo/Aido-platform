import { DrizzlePushDeviceRepository } from "#api/modules/notification/push/infrastructure/persistence/drizzle-push-device.repository";
import { DrizzlePushTokenRepository } from "#api/modules/notification/push/infrastructure/persistence/drizzle-push-token.repository";
import { session, user } from "#api/platform/database/schema/index";
import { describePushDeviceRepositoryContract } from "#test/contracts/notification/push-device-repository.contract";
import { describePushTokenRepositoryContract } from "#test/contracts/notification/push-token-repository.contract";
import { SessionFixture, UserFixture } from "#test/fixtures/index";
import {
  PUSH_DEVICE_FIXTURE_OTHER_USER_ID,
  PUSH_DEVICE_FIXTURE_USER_ID,
  PUSH_FIXTURE_OTHER_SESSION_ID,
  PUSH_FIXTURE_SESSION_ID,
} from "#test/fixtures/notification/push-device.fixture";
import {
  PUSH_TOKEN_FIXTURE_OTHER_USER_ID,
  PUSH_TOKEN_FIXTURE_USER_ID,
} from "#test/fixtures/notification/push-token.fixture";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

describe("DrizzlePushDeviceRepository·PushTokenRepository (실제 PostgreSQL)", () => {
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
        UserFixture.create({ id: PUSH_DEVICE_FIXTURE_USER_ID }),
        UserFixture.create({ id: PUSH_DEVICE_FIXTURE_OTHER_USER_ID }),
        UserFixture.create({ id: PUSH_TOKEN_FIXTURE_USER_ID }),
        UserFixture.create({ id: PUSH_TOKEN_FIXTURE_OTHER_USER_ID }),
      ]);
    await client.insert(session).values([
      SessionFixture.create({ id: PUSH_FIXTURE_SESSION_ID, userId: PUSH_DEVICE_FIXTURE_USER_ID }),
      SessionFixture.create({
        id: PUSH_FIXTURE_OTHER_SESSION_ID,
        userId: PUSH_DEVICE_FIXTURE_OTHER_USER_ID,
      }),
    ]);
  });

  afterAll(async () => {
    await database.stop();
  });

  describePushDeviceRepositoryContract(async () => {
    const { txHost } = createDatabaseTransactionFixture(client);
    return new DrizzlePushDeviceRepository(txHost);
  });

  describePushTokenRepositoryContract(async () => {
    const { txHost } = createDatabaseTransactionFixture(client);
    return new DrizzlePushTokenRepository(txHost);
  });
});
