import { ClsPluginTransactional, TransactionHost } from "@nestjs-cls/transactional";
import { TransactionalAdapterDrizzleOrm } from "@nestjs-cls/transactional-adapter-drizzle-orm";
import { Global, Logger, Module } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Test, type TestingModule } from "@nestjs/testing";
import { sql } from "drizzle-orm";
import { ClsModule } from "nestjs-cls";
import { PgBoss } from "pg-boss";
import { vi } from "vitest";
import { z } from "zod";

import { databaseConfig } from "#api/platform/config/database.config";
import { DRIZZLE, type DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { DatabaseModule } from "#api/platform/database/database.module";
import { EventSubscriptionCatalog } from "#api/platform/events/event-subscription.catalog";
import { FanOutDomainEventPublisher } from "#api/platform/events/fan-out-domain-event.publisher";
import { JobQueueRegistry } from "#api/platform/jobs/job-queue.registry";
import { PgBossJobQueueAdapter } from "#api/platform/jobs/pg-boss-job-queue.adapter";
import {
  AfterCommitTaskRegistryPort,
  defineEventSubscription,
  defineQueue,
  UnitOfWorkPort,
  type PublishedDomainEvent,
} from "#api/shared/application/ports/index";
import { TestDatabase } from "#test/setup/test-database";

const SCHEMA = "pgboss";

const RETRY = {
  retryLimit: 0,
  retryDelaySeconds: 1,
  retryBackoff: false,
  expireInSeconds: 30,
  retentionSeconds: 60 * 60,
  deleteAfterSeconds: 60 * 60,
};

const memoPinnedSchema = z.object({ memoId: z.string(), pinnedAt: z.string() });

function memoQueue(name: string) {
  return defineQueue({
    name,
    payloadSchema: memoPinnedSchema,
    retry: RETRY,
    worker: { localConcurrency: 1, pollingIntervalSeconds: 2 },
  });
}

const ACTIVITY_QUEUE = memoQueue("integration-event.activity");
const REWARD_QUEUE = memoQueue("integration-event.reward");
const CACHE_CHANNEL = "integration-event.memo-cache.invalidate";

const SUBSCRIPTIONS = [
  defineEventSubscription({
    name: "social.memo-activity",
    eventName: "notes.memo.pinned",
    delivery: "durable",
    payloadSchema: memoPinnedSchema,
    queue: ACTIVITY_QUEUE,
  }),
  defineEventSubscription({
    name: "social.memo-reward",
    eventName: "notes.memo.pinned",
    delivery: "durable",
    payloadSchema: memoPinnedSchema,
    queue: REWARD_QUEUE,
  }),
  defineEventSubscription({
    name: CACHE_CHANNEL,
    eventName: "notes.memo.pinned",
    delivery: "after-commit",
    payloadSchema: memoPinnedSchema,
  }),
];

function memoPinned(eventId: string, memoId: string): PublishedDomainEvent {
  return {
    eventName: "notes.memo.pinned",
    eventId,
    occurredAt: Temporal.Instant.from("2026-11-10T00:00:00Z"),
    toPayload: () => ({ memoId, pinnedAt: "2026-11-10T00:00:00.000Z" }),
  };
}

// DrizzleModule이 만드는 기본 pool은 DRIZZLE을 테스트 client로 덮어써 쓰이지 않는다
@Global()
@Module({
  providers: [
    {
      provide: databaseConfig.KEY,
      useValue: { url: "postgresql://unused:unused@localhost:5432/unused", poolMax: 1 },
    },
  ],
  exports: [databaseConfig.KEY],
})
class TestConfigModule {}

describe("도메인 이벤트 fan-out (실제 PostgreSQL·pg-boss)", () => {
  let database: TestDatabase;
  let module: TestingModule;
  let boss: PgBoss;
  let unitOfWork: UnitOfWorkPort;
  let txHost: TransactionHost<DrizzleTransactionalAdapter>;
  let eventEmitter: EventEmitter2;
  let publisher: FanOutDomainEventPublisher;

  async function jobsOf(queue: { readonly name: string }, memoId: string) {
    const jobs = await boss.findJobs<{ memoId: string }>(queue.name);
    return jobs.filter(({ data }) => data.memoId === memoId);
  }

  beforeAll(async () => {
    database = new TestDatabase();
    const client = await database.start();
    const connectionString = database.getConnectionUri();
    const migrator = new PgBoss({ connectionString, schema: SCHEMA, migrate: true });
    await migrator.start();
    await migrator.stop({ graceful: true, timeout: 10_000, close: true });
    boss = new PgBoss({ connectionString, schema: SCHEMA, migrate: false, max: 2 });
    await boss.start();

    module = await Test.createTestingModule({
      imports: [
        TestConfigModule,
        DatabaseModule,
        ClsModule.forRoot({
          global: true,
          plugins: [
            new ClsPluginTransactional({
              imports: [DatabaseModule],
              adapter: new TransactionalAdapterDrizzleOrm({ drizzleInstanceToken: DRIZZLE }),
            }),
          ],
        }),
      ],
    })
      .overrideProvider(DRIZZLE)
      .useValue(client)
      .compile();
    await module.init();
    unitOfWork = module.get(UnitOfWorkPort);
    txHost = module.get<TransactionHost<DrizzleTransactionalAdapter>>(TransactionHost);
    eventEmitter = new EventEmitter2();
    publisher = new FanOutDomainEventPublisher(
      new EventSubscriptionCatalog(SUBSCRIPTIONS),
      new PgBossJobQueueAdapter(boss, txHost, new JobQueueRegistry(), {
        shutdownTimeoutMs: 10_000,
      }),
      module.get(AfterCommitTaskRegistryPort),
      eventEmitter,
    );

    await client.execute(sql`
      CREATE TABLE IF NOT EXISTS public.event_fan_out_probe (memo_id TEXT PRIMARY KEY)
    `);
  });

  afterEach(() => {
    eventEmitter.removeAllListeners();
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await boss?.stop({ graceful: false, close: true });
    await module?.close();
    await database?.stop();
  });

  it("트랜잭션이 rollback되면 durable 구독 작업이 남지 않는다", async () => {
    // When
    await unitOfWork
      .run(async () => {
        await publisher.publish([memoPinned("event-rollback", "memo-rollback")]);
        throw new Error("rollback");
      })
      .catch(() => undefined);

    // Then
    expect(await jobsOf(ACTIVITY_QUEUE, "memo-rollback")).toHaveLength(0);
    expect(await jobsOf(REWARD_QUEUE, "memo-rollback")).toHaveLength(0);
  });

  it("commit되면 durable 구독마다 작업이 하나씩 남는다", async () => {
    // When
    await unitOfWork.run(async () => {
      await publisher.publish([memoPinned("event-commit", "memo-commit")]);
    });

    // Then
    const activity = await jobsOf(ACTIVITY_QUEUE, "memo-commit");
    const reward = await jobsOf(REWARD_QUEUE, "memo-commit");
    expect(activity.map(({ data }) => data)).toEqual([
      { memoId: "memo-commit", pinnedAt: "2026-11-10T00:00:00.000Z" },
    ]);
    expect(reward).toHaveLength(1);
  });

  it("같은 이벤트를 두 번 publish해도 구독당 작업은 하나다", async () => {
    // Given
    const event = memoPinned("event-twice", "memo-twice");

    // When
    await unitOfWork.run(async () => publisher.publish([event]));
    await unitOfWork.run(async () => publisher.publish([event]));

    // Then
    expect(await jobsOf(ACTIVITY_QUEUE, "memo-twice")).toHaveLength(1);
    expect(await jobsOf(REWARD_QUEUE, "memo-twice")).toHaveLength(1);
  });

  it("after-commit 핸들러가 실패해도 커밋한 쓰기와 durable 작업은 남는다", async () => {
    // Given
    vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    const delivered: unknown[] = [];
    eventEmitter.on(CACHE_CHANNEL, async (payload: unknown) => {
      delivered.push(payload);
      throw new Error("cache unavailable");
    });

    // When
    await unitOfWork.run(async () => {
      await txHost.tx.execute(
        sql`INSERT INTO public.event_fan_out_probe (memo_id) VALUES ('memo-after-commit')`,
      );
      await publisher.publish([memoPinned("event-after-commit", "memo-after-commit")]);
      expect(delivered).toEqual([]);
    });

    // Then
    expect(delivered).toEqual([
      { memoId: "memo-after-commit", pinnedAt: "2026-11-10T00:00:00.000Z" },
    ]);
    const probe = await txHost.tx.execute<{ memo_id: string }>(
      sql`SELECT memo_id FROM public.event_fan_out_probe WHERE memo_id = 'memo-after-commit'`,
    );
    expect(probe.rows).toHaveLength(1);
    expect(await jobsOf(ACTIVITY_QUEUE, "memo-after-commit")).toHaveLength(1);
  });
});
