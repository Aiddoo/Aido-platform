import { and, eq } from "drizzle-orm";
import { ClsServiceManager } from "nestjs-cls";

import { DrizzleNotificationReader } from "#api/modules/notification/inbox/infrastructure/persistence/drizzle-notification.reader";
import { DrizzleNotificationRepository } from "#api/modules/notification/inbox/infrastructure/persistence/drizzle-notification.repository";
import { SendNotificationWithDedupUseCase } from "#api/modules/notification/push/application/use-cases/send-notification-with-dedup.use-case";
import { ClsUnitOfWork } from "#api/platform/database/cls-unit-of-work";
import { PostgresMutationLockAdapter } from "#api/platform/database/postgres-mutation-lock.adapter";
import { notification, user } from "#api/platform/database/schema/index";
import { DateClock } from "#test/doubles/platform/date-clock";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { nowInstant } from "#test/fixtures/clock.fixture";
import {
  createNotificationDraftFixture,
  NOTIFICATION_FIXTURE_ACTOR_ID,
  NOTIFICATION_FIXTURE_USER_ID,
} from "#test/fixtures/notification/notification.fixture";
import { createTestClient, createTransactionHost } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

const CONCURRENCY = 10;
const RENDEZVOUS_WAIT_MS = 200;

/** 조회를 마친 실행들을 저장 전에 한데 모은다. 잠금이 없으면 모두 "없음"을 본 채 저장으로 넘어간다 */
class ReadRendezvous {
  #arrivals = 0;
  #release: (() => void) | undefined;
  readonly #released = new Promise<void>((resolve) => {
    this.#release = resolve;
  });

  async wait(): Promise<void> {
    this.#arrivals += 1;
    if (this.#arrivals === 1) {
      // 잠금이 줄을 세우면 다 모이지 않으므로 첫 도착부터 정해진 시간만 기다린다
      setTimeout(() => this.#release?.(), RENDEZVOUS_WAIT_MS);
    }
    if (this.#arrivals >= CONCURRENCY) {
      this.#release?.();
    }
    await this.#released;
  }
}

describe("알림 중복 방지 동시성 (실제 PostgreSQL)", () => {
  let testDatabase: TestDatabase;
  let client: TestDatabaseClient;

  beforeAll(async () => {
    testDatabase = new TestDatabase({
      // 풀이 동시 실행 수보다 작으면 연결 대기가 줄을 세워 잠금 없이도 통과한다
      createClient: (connectionString) => createTestClient(connectionString, { max: CONCURRENCY }),
    });
    client = await testDatabase.start();
  }, 60_000);

  beforeEach(async () => {
    await testDatabase.cleanup();
    await client.insert(user).values(
      [NOTIFICATION_FIXTURE_USER_ID, NOTIFICATION_FIXTURE_ACTOR_ID].map((id, index) => ({
        id,
        email: `dedup-${index}@example.com`,
        userTag: `DEDUP${index}`,
        updatedAt: nowInstant(),
        status: "ACTIVE" as const,
        subscriptionStatus: "FREE" as const,
      })),
    );
  });

  afterAll(async () => {
    await testDatabase.stop();
  });

  it("같은 친구의 팔로우 알림이 동시에 여러 번 와도 하나만 저장한다", async () => {
    // Given
    const txHost = createTransactionHost(client);
    const unitOfWork = new ClsUnitOfWork(txHost, ClsServiceManager.getClsService());
    const repository = new DrizzleNotificationRepository(txHost);
    const reader = new DrizzleNotificationReader(txHost);
    const rendezvous = new ReadRendezvous();
    const useCase = new SendNotificationWithDedupUseCase({
      // SendNotificationUseCase의 저장 단계를 같은 방식(Required 전파)으로 실행한다
      sendNotification: {
        execute: (data) => unitOfWork.run(() => repository.createNotification(data)),
      },
      unitOfWork,
      mutationLock: new PostgresMutationLockAdapter(txHost),
      notificationHistoryReader: {
        existsRecentNotification: async (query) => {
          const exists = await reader.existsRecentNotification(query);
          await rendezvous.wait();
          return exists;
        },
      },
      clock: new DateClock(),
      logger: new SilentLogger(),
    });
    const follow = createNotificationDraftFixture({
      type: "FOLLOW_NEW",
      friendId: NOTIFICATION_FIXTURE_ACTOR_ID,
    });

    // When
    const results = await Promise.all(
      Array.from({ length: CONCURRENCY }, () => useCase.execute(follow)),
    );

    // Then
    expect(results.filter((result) => result != null)).toHaveLength(1);
    expect(
      await client.$count(
        notification,
        and(
          eq(notification.userId, NOTIFICATION_FIXTURE_USER_ID),
          eq(notification.type, "FOLLOW_NEW"),
        ),
      ),
    ).toBe(1);
  });
});
