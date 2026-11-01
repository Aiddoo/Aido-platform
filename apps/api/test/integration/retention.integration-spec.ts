import { eq, inArray } from "drizzle-orm";

import { DrizzleRetentionRepository } from "#api/modules/notification/infrastructure/persistence/retention/drizzle-retention.repository";
import { createEntityId } from "#api/platform/database/entity-id";
import {
  notification,
  pushDispatch,
  retentionPushOutbox,
  todo,
  todoCategory,
  userPreference,
} from "#api/platform/database/schema/index";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import type { TestDatabaseClient } from "#test/setup/test-database";
import { createUserDatabaseFixture } from "#test/setup/user-database-fixture";

import { TestDatabase } from "../setup/test-database.js";

describe("신규 사용자 리텐션 V2 통합 테스트 (실제 DB)", () => {
  let testDb: TestDatabase;
  let db: TestDatabaseClient;
  let repository: DrizzleRetentionRepository;
  let unitOfWork: ReturnType<typeof createDatabaseTransactionFixture>["uow"];

  beforeAll(async () => {
    testDb = new TestDatabase();
    db = await testDb.start();
    const { txHost, uow } = createDatabaseTransactionFixture(db);
    unitOfWork = uow;
    repository = new DrizzleRetentionRepository(txHost, uow);
  }, 60_000);

  beforeEach(async () => {
    await testDb.cleanup();
  });

  afterAll(async () => {
    await testDb.stop();
  });

  async function createUser(email: string): Promise<string> {
    const user = await createUserDatabaseFixture(
      db,
      {
        email,
        userTag: email.slice(0, 8).toUpperCase().padEnd(8, "X"),
        status: "ACTIVE",
      },
      {
        preference: {
          id: createEntityId(),
          pushEnabled: true,
          timezone: "Asia/Seoul",
          locale: "ko",
        },
        consent: { id: createEntityId(), marketingPushAgreedAt: new Date() },
      },
    );
    return user.id;
  }

  it("기존 사용자는 migration 이후에도 assignment가 자동 생성되지 않는다", async () => {
    const userId = await createUser("legacy01@example.com");

    const assignmentCount = await db.query.retentionExperimentAssignment.findMany({
      where: { userId },
    });

    expect(assignmentCount).toHaveLength(0);
  });

  it("신규 등록은 한 assignment와 네 단계만 멱등 생성한다", async () => {
    const userId = await createUser("newuser1@example.com");
    const startedAt = new Date("2026-07-15T00:00:00Z");

    await repository.enroll({ userId, variant: "TREATMENT", startedAt });
    await repository.enroll({ userId, variant: "CONTROL", startedAt });

    const assignments = await db.query.retentionExperimentAssignment.findMany({
      where: { userId },
      with: { stages: true },
    });
    expect(assignments).toHaveLength(1);
    expect(assignments[0]?.variant).toBe("TREATMENT");
    expect(assignments[0]?.stages).toHaveLength(4);
  });

  it("stage 후보를 N+1 없이 집계 projection으로 조회한다", async () => {
    const userId = await createUser("projection@example.com");
    await repository.enroll({
      userId,
      variant: "TREATMENT",
      startedAt: new Date("2026-07-15T00:00:00Z"),
    });

    const candidates = await repository.findScheduledStages(200);

    expect(candidates).toHaveLength(4);
    expect(
      candidates.every(
        (candidate) =>
          candidate.todoCount === 0 &&
          candidate.completedCount === 0 &&
          candidate.incompleteCount === 0 &&
          candidate.activeTokenCount === 0 &&
          !candidate.todoActionWithinWindow,
      ),
    ).toBe(true);
  });

  it("저장된 타임존이 잘못되어도 UTC로 조회하고 유효한 별칭은 보존한다", async () => {
    const invalidTimezoneUserId = await createUser("invalidtz@example.com");
    const aliasTimezoneUserId = await createUser("aliastz1@example.com");
    await Promise.all([
      db
        .update(userPreference)
        .set({ timezone: "Invalid/Timezone" })
        .where(eq(userPreference.userId, invalidTimezoneUserId)),
      db
        .update(userPreference)
        .set({ timezone: "US/Eastern" })
        .where(eq(userPreference.userId, aliasTimezoneUserId)),
    ]);
    const [[invalidCategory], [aliasCategory]] = await Promise.all([
      db
        .insert(todoCategory)
        .values({ userId: invalidTimezoneUserId, name: "업무", color: "#FF6B43" })
        .returning({ id: todoCategory.id }),
      db
        .insert(todoCategory)
        .values({ userId: aliasTimezoneUserId, name: "업무", color: "#FF6B43" })
        .returning({ id: todoCategory.id }),
    ]);
    if (invalidCategory === undefined || aliasCategory === undefined) {
      throw new Error("category fixture 누락");
    }
    await Promise.all([
      db.insert(todo).values({
        userId: invalidTimezoneUserId,
        categoryId: invalidCategory.id,
        title: "잘못된 타임존에서도 조회되는 할 일",
        startDate: new Date("2026-07-16T00:00:00.000Z"),
      }),
      db.insert(todo).values({
        userId: aliasTimezoneUserId,
        categoryId: aliasCategory.id,
        title: "레거시 별칭에서도 조회되는 할 일",
        startDate: new Date("2026-07-16T00:00:00.000Z"),
      }),
    ]);
    const startedAt = new Date("2026-07-15T00:00:00.000Z");
    await Promise.all([
      repository.enroll({
        userId: invalidTimezoneUserId,
        variant: "TREATMENT",
        startedAt,
      }),
      repository.enroll({
        userId: aliasTimezoneUserId,
        variant: "TREATMENT",
        startedAt,
      }),
    ]);

    const candidates = await repository.findScheduledStages(200);
    const invalidTimezoneCandidates = candidates.filter(
      (candidate) => candidate.userId === invalidTimezoneUserId,
    );
    const aliasTimezoneCandidates = candidates.filter(
      (candidate) => candidate.userId === aliasTimezoneUserId,
    );

    expect(invalidTimezoneCandidates).toHaveLength(4);
    expect(
      invalidTimezoneCandidates.every(
        (candidate) => candidate.timezone === "UTC" && candidate.todoCount === 1,
      ),
    ).toBe(true);
    expect(aliasTimezoneCandidates).toHaveLength(4);
    expect(
      aliasTimezoneCandidates.every(
        (candidate) => candidate.timezone === "US/Eastern" && candidate.todoCount === 1,
      ),
    ).toBe(true);
  });

  it("Notification·Dispatch·Outbox 생성 실패 시 단계 상태까지 전부 rollback한다", async () => {
    const userId = await createUser("rollback@example.com");
    await repository.enroll({
      userId,
      variant: "TREATMENT",
      startedAt: new Date(),
    });
    const stage = await db.query.retentionExperimentStage.findFirst({
      where: { stage: "D0", assignment: { userId } },
    });
    if (stage === undefined) {
      throw new Error("stage fixture 누락");
    }

    await expect(
      unitOfWork.run(async () => {
        await repository.createDelivery({
          stageId: stage.id,
          userId,
          timezone: "Asia/Seoul",
          title: "title",
          body: "body",
          route: "/feed",
          variantId: "d0_no_todo",
        });
        throw new Error("force rollback");
      }),
    ).rejects.toThrow("force rollback");

    const [storedStage, notifications, dispatches, outboxes] = await Promise.all([
      db.query.retentionExperimentStage.findFirst({ where: { id: stage.id } }),
      db.$count(notification, eq(notification.userId, userId)),
      db.$count(pushDispatch, eq(pushDispatch.userId, userId)),
      db.$count(retentionPushOutbox),
    ]);
    expect(storedStage?.status).toBe("SCHEDULED");
    expect([notifications, dispatches, outboxes]).toEqual([0, 0, 0]);
  });

  it("동시 relay가 SKIP LOCKED로 서로 다른 outbox를 한 번씩 claim한다", async () => {
    // Given
    const claimAt = new Date("2026-07-02T00:00:00.000Z");
    const userId = await createUser("claimbox@example.com");
    await repository.enroll({
      userId,
      variant: "TREATMENT",
      startedAt: claimAt,
    });
    const stages = await db.query.retentionExperimentStage.findMany({
      where: { stage: { in: ["D0", "D1"] }, assignment: { userId } },
      orderBy: { stage: "asc" },
    });
    for (const stage of stages) {
      await repository.createDelivery({
        stageId: stage.id,
        userId,
        timezone: "Asia/Seoul",
        title: `title-${stage.stage}`,
        body: "body",
        route: "/feed",
        variantId: `variant-${stage.stage}`,
      });
    }

    await db
      .update(retentionPushOutbox)
      .set({ availableAt: claimAt })
      .where(
        inArray(
          retentionPushOutbox.stageId,
          stages.map((stage) => stage.id),
        ),
      );

    // When
    const batches = await Promise.all([
      repository.claimOutboxes(1, claimAt),
      repository.claimOutboxes(1, claimAt),
    ]);
    const claimed = batches.flat();
    const stored = await db.query.retentionPushOutbox.findMany({
      where: { id: { in: claimed.map((outbox) => outbox.id) } },
    });

    // Then
    expect(claimed).toHaveLength(2);
    expect(new Set(claimed.map((outbox) => outbox.id)).size).toBe(2);
    expect(claimed.every((outbox) => outbox.attempts === 1)).toBe(true);
    expect(stored.every((outbox) => outbox.status === "PROCESSING")).toBe(true);
  });
});
