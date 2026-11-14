import { PgBoss } from "pg-boss";
import { vi } from "vitest";

import { pushDeliveryJobKey } from "#api/modules/notification/push/infrastructure/jobs/notification-job-keys.constants";
import { PushDeliveryQueueAdapter } from "#api/modules/notification/push/infrastructure/jobs/push-delivery-queue.adapter";
import {
  PUSH_DELIVERY_QUEUE,
  PUSH_DELIVERY_TRANSACTIONAL_QUEUE,
} from "#api/modules/notification/push/infrastructure/jobs/push-delivery.queue";
import { JobQueueRegistry } from "#api/platform/jobs/job-queue.registry";
import {
  deterministicJobId,
  PgBossJobQueueAdapter,
} from "#api/platform/jobs/pg-boss-job-queue.adapter";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { TestDatabase } from "#test/setup/test-database";

import { WORKER_WAIT } from "../../helpers/fast-job-timing.js";

const SCHEMA = "pgboss_push_lanes";

describe("푸시 발송 차선 (실제 PostgreSQL + pg-boss)", () => {
  let testDatabase: TestDatabase;
  let boss: PgBoss;
  let jobQueue: PgBossJobQueueAdapter;

  beforeAll(async () => {
    testDatabase = new TestDatabase();
    const client = await testDatabase.start();
    const connectionString = testDatabase.getConnectionUri();
    const migrator = new PgBoss({ connectionString, schema: SCHEMA, migrate: true });
    await migrator.start();
    await migrator.stop({ graceful: true, timeout: 10_000, close: true });

    boss = new PgBoss({
      connectionString,
      schema: SCHEMA,
      migrate: false,
      createSchema: false,
      max: 3,
      useListenNotify: false,
    });
    await boss.start();
    jobQueue = new PgBossJobQueueAdapter(
      boss,
      createDatabaseTransactionFixture(client).txHost,
      new JobQueueRegistry(),
      { shutdownTimeoutMs: 10_000, workerEnabled: true },
    );
  }, 60_000);

  afterAll(async () => {
    await boss?.stop({ graceful: false, close: true });
    await testDatabase?.stop();
  });

  it("거래성 전용 worker는 마케팅 작업이 쌓여 있어도 우선순위 10 작업만 가져가고 옛 key·id를 그대로 쓴다", async () => {
    // Given: 마케팅 작업이 먼저 쌓이고 리마인더가 뒤에 들어온다
    const adapter = new PushDeliveryQueueAdapter(jobQueue);
    const campaign = [
      [{ dispatchId: 1, publishAttempt: 1 }],
      [{ dispatchId: 2, publishAttempt: 1 }],
      [{ dispatchId: 3, publishAttempt: 1 }],
    ];
    for (const publications of campaign) {
      await adapter.enqueueDeliveries(publications, "MARKETING");
    }
    const reminder = [{ dispatchId: 9, publishAttempt: 2 }];
    await adapter.enqueueDeliveries(reminder, "TRANSACTIONAL");
    const received: unknown[] = [];

    // When
    await jobQueue.work(PUSH_DELIVERY_TRANSACTIONAL_QUEUE, async (jobs) => {
      received.push(...jobs.map(({ data }) => data.data));
    });

    // Then
    await vi.waitFor(() => {
      expect(received).toEqual([reminder]);
    }, WORKER_WAIT);
    const queued = await boss.findJobs(PUSH_DELIVERY_QUEUE.name, { queued: true });
    expect(queued.map(({ priority }) => priority)).toEqual([0, 0, 0]);
    const [reminderJob] = await boss.findJobs(PUSH_DELIVERY_QUEUE.name, {
      id: deterministicJobId(PUSH_DELIVERY_QUEUE.name, pushDeliveryJobKey(reminder)),
    });
    expect(reminderJob).toMatchObject({
      priority: 10,
      singletonKey: pushDeliveryJobKey(reminder),
      deadLetter: "push-delivery-dead-letter.v1",
      retryLimit: 5,
    });
  });
});
