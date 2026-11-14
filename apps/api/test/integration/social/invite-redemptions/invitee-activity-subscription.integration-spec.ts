import { TransactionHost } from "@nestjs-cls/transactional";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { count, eq } from "drizzle-orm";
import { PgBoss } from "pg-boss";

import { RecordInviteeActivityUseCase } from "#api/modules/social/invite-redemptions/application/use-cases/record-invitee-activity.use-case";
import { RedeemInviteUseCase } from "#api/modules/social/invite-redemptions/application/use-cases/redeem-invite.use-case";
import {
  INVITEE_ACTIVITY_SUBSCRIPTION,
  InviteeActivityEventHandler,
} from "#api/modules/social/invite-redemptions/infrastructure/event-handlers/invitee-activity.event-handler";
import { INVITEE_ACTIVITY_QUEUE } from "#api/modules/social/invite-redemptions/infrastructure/jobs/invitee-activity.queue";
import { InviteConfigPort } from "#api/modules/social/invites/application/ports/invite-config.port";
import { IssueMyInviteUseCase } from "#api/modules/social/invites/application/use-cases/issue-my-invite.use-case";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { inviteActiveDay, user } from "#api/platform/database/schema/index";
import { EventSubscriptionCatalog } from "#api/platform/events/event-subscription.catalog";
import { FanOutDomainEventPublisher } from "#api/platform/events/fan-out-domain-event.publisher";
import { JobQueueRegistry } from "#api/platform/jobs/job-queue.registry";
import { PgBossJobQueueAdapter } from "#api/platform/jobs/pg-boss-job-queue.adapter";
import { AfterCommitTaskRegistryPort } from "#api/shared/application/ports/after-commit-task.registry.port";
import { type PublishedDomainEvent } from "#api/shared/application/ports/domain-event-publisher.port";
import { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { createEntityId } from "#api/shared/domain/model/entity-id";
import { UserFixture } from "#test/fixtures/index";
import { createTestClient } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

import {
  createE2eApp,
  destroyE2eApp,
  type E2eTestContext,
} from "../../../e2e/helpers/e2e-app-factory.js";

const SCHEMA = "pgboss";
// 2028-02-28 12:00 KST에 수락하고 한 시간 뒤 첫 할 일을 마친다
const JOINED_AT = new Date("2028-02-28T03:00:00.000Z");
const COMPLETED_AT = "2028-02-28T04:00:00.000Z";

function todoCompleted(eventId: string, userId: string): PublishedDomainEvent {
  return {
    eventName: "planning.todo.completed",
    eventId,
    occurredAt: Temporal.Instant.from(COMPLETED_AT),
    toPayload: () => ({ todoId: 1, userId, occurredAt: COMPLETED_AT }),
  };
}

describe("초대 사용 시작 기록의 내구성 구독 (실제 PostgreSQL·pg-boss)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;
  let context: E2eTestContext;
  let boss: PgBoss;
  let unitOfWork: UnitOfWorkPort;
  let eventEmitter: EventEmitter2;
  let publisher: FanOutDomainEventPublisher;
  let handler: InviteeActivityEventHandler;

  beforeAll(async () => {
    database = new TestDatabase({ createClient: (url) => createTestClient(url, { max: 10 }) });
    client = await database.start();
    const connectionString = database.getConnectionUri();
    const migrator = new PgBoss({ connectionString, schema: SCHEMA, migrate: true });
    await migrator.start();
    await migrator.stop({ graceful: true, timeout: 10_000, close: true });
    boss = new PgBoss({ connectionString, schema: SCHEMA, migrate: false, max: 2 });
    await boss.start();

    context = await createE2eApp({
      testDatabase: database,
      customizeBuilder: (builder) =>
        builder.overrideProvider(InviteConfigPort).useValue({ isEnabled: true }),
    });
    unitOfWork = context.module.get(UnitOfWorkPort);
    const jobQueue = new PgBossJobQueueAdapter(
      boss,
      context.module.get<TransactionHost<DrizzleTransactionalAdapter>>(TransactionHost),
      new JobQueueRegistry(),
      { shutdownTimeoutMs: 10_000, workerEnabled: true },
    );
    // 커밋 뒤 in-process 전달을 받을 리스너가 하나도 없는 emitter다
    eventEmitter = new EventEmitter2();
    publisher = new FanOutDomainEventPublisher(
      new EventSubscriptionCatalog([INVITEE_ACTIVITY_SUBSCRIPTION]),
      jobQueue,
      context.module.get(AfterCommitTaskRegistryPort),
      eventEmitter,
    );
    handler = new InviteeActivityEventHandler(
      context.module.get(RecordInviteeActivityUseCase),
      jobQueue,
    );
  });

  beforeEach(async () => {
    await context.reset();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(JOINED_AT);
  });

  afterEach(() => vi.useRealTimers());

  afterAll(async () => {
    await boss?.stop({ graceful: false, close: true });
    if (context) {
      await destroyE2eApp(context);
    } else {
      await database?.stop();
    }
  });

  async function redeemedInviteeId(inviterTag: string, inviteeTag: string): Promise<string> {
    const [inviterId, inviteeId] = [createEntityId(), createEntityId()];
    await client
      .insert(user)
      .values([
        UserFixture.create({ id: inviterId, userTag: inviterTag, email: `${inviterTag}@e.test` }),
        UserFixture.create({ id: inviteeId, userTag: inviteeTag, email: `${inviteeTag}@e.test` }),
      ]);
    const { code } = await context.module.get(IssueMyInviteUseCase).execute({ inviterId });
    const redeemed = await context.module.get(RedeemInviteUseCase).execute({
      inviteeId,
      code,
      installationId: inviteeTag,
      timezone: "Asia/Seoul",
    });
    if (redeemed.outcome !== "REDEEMED") {
      throw new Error("새 사용자 수락이 필요합니다");
    }
    return inviteeId;
  }

  async function queuedPayloadsFor(inviteeId: string) {
    const jobs = await boss.findJobs<{ todoId: number; userId: string; occurredAt: string }>(
      INVITEE_ACTIVITY_QUEUE.name,
    );
    return jobs.filter(({ data }) => data.userId === inviteeId).map(({ data }) => data);
  }

  async function activeDaysOf(inviteeId: string): Promise<number> {
    const redemption = await client.query.inviteRedemption.findFirst({
      columns: { id: true },
      where: { inviteeId },
    });
    const [row] = await client
      .select({ total: count() })
      .from(inviteActiveDay)
      .where(eq(inviteActiveDay.redemptionId, redemption?.id ?? ""));
    return row?.total ?? 0;
  }

  it("커밋한 완료 이벤트는 in-process 리스너가 없어도 큐에 한 번 남고, 같은 작업을 두 번 처리해도 활동일은 하루다", async () => {
    // Given
    const inviteeId = await redeemedInviteeId("DURINVTR", "DURINVTE");
    const event = todoCompleted("event-durable", inviteeId);

    // When
    await unitOfWork.run(async () => publisher.publish([event]));
    await unitOfWork.run(async () => publisher.publish([event]));
    const payloads = await queuedPayloadsFor(inviteeId);
    for (const payload of [...payloads, ...payloads]) {
      await handler.handle(payload);
    }

    // Then
    expect({
      listeners: eventEmitter.eventNames().length,
      queued: payloads,
      activeDays: await activeDaysOf(inviteeId),
    }).toEqual({
      listeners: 0,
      queued: [{ todoId: 1, userId: inviteeId, occurredAt: COMPLETED_AT }],
      activeDays: 1,
    });
  });

  it("트랜잭션이 rollback되면 구독 작업도 남지 않는다", async () => {
    // Given
    const inviteeId = await redeemedInviteeId("RBKINVTR", "RBKINVTE");

    // When
    await unitOfWork
      .run(async () => {
        await publisher.publish([todoCompleted("event-rollback", inviteeId)]);
        throw new Error("rollback");
      })
      .catch(() => undefined);

    // Then
    expect(await queuedPayloadsFor(inviteeId)).toEqual([]);
  });
});
