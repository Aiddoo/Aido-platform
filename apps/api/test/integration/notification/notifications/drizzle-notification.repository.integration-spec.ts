import { TransactionHost } from "@nestjs-cls/transactional";
import { Global, Module } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { UnreadNotificationCountReaderPort } from "#api/modules/notification/notifications/application/ports/unread-notification-count.reader.port";
import { NotificationCacheKey } from "#api/modules/notification/notifications/infrastructure/cache/notification-cache.keyspace";
import { DrizzleNotificationReader } from "#api/modules/notification/notifications/infrastructure/persistence/drizzle-notification.reader";
import { DrizzleNotificationRepository } from "#api/modules/notification/notifications/infrastructure/persistence/drizzle-notification.repository";
import { NotificationNotificationsQueriesModule } from "#api/modules/notification/notifications/notification-notifications-queries.public";
import { InMemoryCacheStore } from "#api/platform/cache/adapters/in-memory-cache.store";
import { CacheStorePort } from "#api/platform/cache/cache-store.port";
import { user } from "#api/platform/database/schema/index";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { describeNotificationRepositoryContract } from "#test/contracts/notification/notification-repository.contract";
import { createUserRowFixture } from "#test/fixtures/identity/user-row.fixture";
import {
  createNotificationDraftFixture,
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
        createUserRowFixture({ id: NOTIFICATION_FIXTURE_USER_ID }),
        createUserRowFixture({ id: NOTIFICATION_FIXTURE_OTHER_USER_ID }),
        createUserRowFixture({ id: NOTIFICATION_FIXTURE_ACTOR_ID }),
      ]);
  });

  afterAll(async () => {
    await database.stop();
  });

  describeNotificationRepositoryContract(async () => {
    const { transactionHost } = createDatabaseTransactionFixture(client);
    const reader = new DrizzleNotificationReader(transactionHost);
    return {
      repository: new DrizzleNotificationRepository(transactionHost),
      inboxReader: reader,
      historyReader: reader,
      unreadCountReader: reader,
    };
  });

  it("푸시 배지의 안 읽은 수는 커밋 뒤 아직 비우지 않은 알림함 캐시 값이 아니라 지금 DB 수다", async () => {
    // Given
    const { transactionHost } = createDatabaseTransactionFixture(client);
    const cache = new InMemoryCacheStore({ defaultTtlMs: 60_000, maxItems: 100 });
    @Global()
    @Module({
      providers: [
        { provide: TransactionHost, useValue: transactionHost },
        { provide: CacheStorePort, useValue: cache },
      ],
      exports: [TransactionHost, CacheStorePort],
    })
    class InfrastructureModule {}
    const module = await Test.createTestingModule({
      imports: [InfrastructureModule, NotificationNotificationsQueriesModule],
    }).compile();
    const repository = new DrizzleNotificationRepository(transactionHost);
    await repository.createNotification(createNotificationDraftFixture());
    await cache.set(NotificationCacheKey.unreadCount(NOTIFICATION_FIXTURE_USER_ID), 1);
    await repository.createNotification(createNotificationDraftFixture());

    // When
    const counts = await module
      .get(UnreadNotificationCountReaderPort)
      .countUnreadByUsers([UserId.reconstitute(NOTIFICATION_FIXTURE_USER_ID)]);

    // Then
    expect([...counts]).toEqual([[NOTIFICATION_FIXTURE_USER_ID, 2]]);
    await module.close();
  });
});
