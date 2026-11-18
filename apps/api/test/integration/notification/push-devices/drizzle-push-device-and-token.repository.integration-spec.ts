import { eq, sql } from "drizzle-orm";

import { PushTokenRegistrationConflictError } from "#api/modules/notification/push-devices/application/push-devices.errors";
import { DrizzlePushDeviceRepository } from "#api/modules/notification/push-devices/infrastructure/persistence/drizzle-push-device.repository";
import { DrizzlePushTokenRepository } from "#api/modules/notification/push-devices/infrastructure/persistence/drizzle-push-token.repository";
import { pushToken, session, user } from "#api/platform/database/schema/index";
import { describePushDeviceRepositoryContract } from "#test/contracts/notification/push-device-repository.contract";
import { describePushTokenRepositoryContract } from "#test/contracts/notification/push-token-repository.contract";
import { createSessionRowFixture } from "#test/fixtures/identity/session-row.fixture";
import { createUserRowFixture } from "#test/fixtures/identity/user-row.fixture";
import {
  createPushDeviceFixture,
  PUSH_DEVICE_FIXTURE_NOW,
  PUSH_DEVICE_FIXTURE_OTHER_USER_ID,
  PUSH_DEVICE_FIXTURE_USER_ID,
  PUSH_FIXTURE_OTHER_SESSION_ID,
  PUSH_FIXTURE_SESSION_ID,
} from "#test/fixtures/notification/push-device.fixture";
import {
  PUSH_TOKEN_FIXTURE_OTHER_USER_ID,
  PUSH_TOKEN_FIXTURE_USER_ID,
} from "#test/fixtures/notification/push-token.fixture";
import { createDatabaseTransactionFixture, createTestClient } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

describe("DrizzlePushDeviceRepository·PushTokenRepository (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;

  beforeAll(async () => {
    // 토큰 충돌 사례가 두 연결을 함께 쓴다
    database = new TestDatabase({ createClient: (url) => createTestClient(url, { max: 4 }) });
    client = await database.start();
  });

  beforeEach(async () => {
    await database.cleanup();
    await client
      .insert(user)
      .values([
        createUserRowFixture({ id: PUSH_DEVICE_FIXTURE_USER_ID }),
        createUserRowFixture({ id: PUSH_DEVICE_FIXTURE_OTHER_USER_ID }),
        createUserRowFixture({ id: PUSH_TOKEN_FIXTURE_USER_ID }),
        createUserRowFixture({ id: PUSH_TOKEN_FIXTURE_OTHER_USER_ID }),
      ]);
    await client.insert(session).values([
      createSessionRowFixture({ id: PUSH_FIXTURE_SESSION_ID, userId: PUSH_DEVICE_FIXTURE_USER_ID }),
      createSessionRowFixture({
        id: PUSH_FIXTURE_OTHER_SESSION_ID,
        userId: PUSH_DEVICE_FIXTURE_OTHER_USER_ID,
      }),
    ]);
  });

  afterAll(async () => {
    await database.stop();
  });

  function createSubject() {
    const { transactionHost } = createDatabaseTransactionFixture(client);
    return Promise.resolve({
      devices: new DrizzlePushDeviceRepository(transactionHost),
      tokens: new DrizzlePushTokenRepository(transactionHost),
    });
  }

  describePushDeviceRepositoryContract(createSubject);

  describePushTokenRepositoryContract(createSubject);

  it("넘겨받은 뒤 다른 연결이 같은 토큰을 먼저 커밋하면 저장이 등록 충돌 오류를 낸다", async () => {
    // Given
    // 다른 연결이 같은 토큰을 다른 사용자로 넣고 커밋하지 않은 채 잡고 있다
    const token = "ExponentPushToken[contended]";
    let releaseHolder: () => void = () => {};
    const holderCommitted = new Promise<void>((resolve) => {
      releaseHolder = resolve;
    });
    let markInserted: () => void = () => {};
    const inserted = new Promise<void>((resolve) => {
      markInserted = resolve;
    });
    const holder = client.transaction(async (transaction) => {
      await transaction.insert(pushToken).values({
        userId: PUSH_DEVICE_FIXTURE_OTHER_USER_ID,
        token,
        deviceId: "ios_holder",
        platform: "IOS",
        updatedAt: PUSH_DEVICE_FIXTURE_NOW,
      });
      markInserted();
      await holderCommitted;
    });
    await inserted;
    const { devices } = await createSubject();

    // When
    // 넘겨받기 DELETE는 커밋 전 행을 보지 못하고, 등록 insert가 unique 키에서 기다리다 충돌한다
    const saving = devices.save(createPushDeviceFixture({ token }));
    const settled = saving.then(
      () => null,
      (error: unknown) => error,
    );
    await vi.waitFor(
      async () => {
        const result = await client.execute<{ waiting: number }>(
          sql`SELECT COUNT(*)::INT AS waiting FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND wait_event = 'transactionid'`,
        );
        expect(result.rows[0]?.waiting ?? 0).toBeGreaterThanOrEqual(1);
      },
      { timeout: 5000 },
    );
    releaseHolder();
    await holder;

    // Then
    expect(await settled).toBeInstanceOf(PushTokenRegistrationConflictError);
    expect(await client.select().from(pushToken).where(eq(pushToken.token, token))).toEqual([
      expect.objectContaining({
        userId: PUSH_DEVICE_FIXTURE_OTHER_USER_ID,
        deviceId: "ios_holder",
      }),
    ]);
  });
});
