import { eq } from "drizzle-orm";

import { ProcessRetentionStagesUseCase } from "#api/modules/notification/retention/application/use-cases/process-retention-stages.use-case";
import { isRetentionStageDue } from "#api/modules/notification/retention/domain/retention-stage.domain-service";
import { DrizzleRetentionRepository } from "#api/modules/notification/retention/infrastructure/persistence/drizzle-retention.repository";
import { createEntityId } from "#api/platform/database/entity-id";
import { todo, todoCategory, userPreference } from "#api/platform/database/schema/index";
import { describeRetentionRepositoryContract } from "#test/contracts/notification/retention-repository.contract";
import { RecordingNotificationPublisher } from "#test/doubles/notification/recording-notification-publisher";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";
import { createUserDatabaseFixture } from "#test/setup/user-database-fixture";

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

  async function createUser(
    email: string,
    options: { readonly timezone?: string; readonly withPushToken?: boolean } = {},
  ): Promise<string> {
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
          timezone: options.timezone ?? "Asia/Seoul",
          locale: "ko",
        },
        consent: {
          id: createEntityId(),
          marketingPushAgreedAt: Temporal.Instant.fromEpochMilliseconds(Date.now()),
        },
        ...(options.withPushToken === true && {
          pushTokens: {
            token: `ExponentPushToken[${email}]`,
            deviceId: `device-${email}`,
            platform: "IOS",
            updatedAt: Temporal.Now.instant(),
          },
        }),
      },
    );
    return user.id;
  }

  async function stagesOf(userId: string) {
    return db.query.retentionExperimentStage.findMany({ where: { assignment: { userId } } });
  }

  const ALL_DUE_AT = new Date("2026-08-01T00:00:00.000Z");

  describeRetentionRepositoryContract(async () => ({
    repository,
    givenUser: async ({ timezone, locale }) => {
      const userId = await createUser(`${createEntityId().slice(-8)}@example.com`, { timezone });
      await db.update(userPreference).set({ locale }).where(eq(userPreference.userId, userId));
      return userId;
    },
    d7ResultOf: async (assignmentId) => {
      const result = await db.query.retentionExperimentResult.findFirst({
        where: { assignmentId },
      });
      return result == null
        ? null
        : {
            returnedWithinD7: result.returnedWithinD7,
            todoActionWithinD7: result.todoActionWithinD7,
            measuredAt: result.measuredAt,
          };
    },
  }));

  it("기존 사용자는 migration 이후에도 assignment가 자동 생성되지 않는다", async () => {
    const userId = await createUser("legacy01@example.com");

    const assignmentCount = await db.query.retentionExperimentAssignment.findMany({
      where: { userId },
    });

    expect(assignmentCount).toHaveLength(0);
  });

  it("stage 후보를 N+1 없이 집계 projection으로 조회한다", async () => {
    const userId = await createUser("projection@example.com");
    await repository.enroll({
      userId,
      variant: "TREATMENT",
      startedAt: new Date("2026-07-15T00:00:00Z"),
    });

    const candidates = await repository.findDueStages({ dueAt: ALL_DUE_AT, limit: 200 });

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

    const candidates = await repository.findDueStages({ dueAt: ALL_DUE_AT, limit: 200 });
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

  async function stageOf(userId: string, stageName: "D0" | "D1") {
    const stage = await db.query.retentionExperimentStage.findFirst({
      where: { stage: stageName, assignment: { userId } },
    });
    if (stage == null) {
      throw new Error("stage fixture 누락");
    }
    return stage;
  }

  it("같은 단계는 동시에 처리해도 한 실행만 발송 대상으로 가져간다", async () => {
    // Given
    const userId = await createUser("claimone@example.com");
    await repository.enroll({ userId, variant: "TREATMENT", startedAt: new Date() });
    const stage = await stageOf(userId, "D0");

    // When
    const claimed = await Promise.all([
      unitOfWork.run(() => repository.markStageOutboxed(stage.id, new Date())),
      unitOfWork.run(() => repository.markStageOutboxed(stage.id, new Date())),
    ]);

    // Then
    expect(claimed.toSorted()).toEqual([false, true]);
  });

  it("발행이 실패하면 단계 claim도 rollback돼 다음 sweep이 다시 처리한다", async () => {
    // Given
    const userId = await createUser("rollback@example.com");
    await repository.enroll({ userId, variant: "TREATMENT", startedAt: new Date() });
    const stage = await stageOf(userId, "D0");

    // When
    await expect(
      unitOfWork.run(async () => {
        await repository.markStageOutboxed(stage.id, new Date());
        throw new Error("publish failed");
      }),
    ).rejects.toThrow("publish failed");

    // Then
    const stored = await db.query.retentionExperimentStage.findFirst({ where: { id: stage.id } });
    expect(stored?.status).toBe("SCHEDULED");
  });

  it("결정할 때가 된 단계만 고르고 그 기준은 도메인 isRetentionStageDue와 같다", async () => {
    // Given: 오프셋이 다른 시간대(30·45분 단위, DST, 날짜변경선, 잘못된 값)의 사용자가 같은 시각에 시작했다
    const startedAt = new Date("2026-03-07T13:17:00.000Z");
    const timezones = [
      "Asia/Seoul",
      "America/New_York",
      "Europe/London",
      "Asia/Kolkata",
      "Asia/Kathmandu",
      "Pacific/Auckland",
      "Pacific/Kiritimati",
      "Invalid/Timezone",
    ];
    const timezoneByUserId = new Map<string, string>();
    for (const [index, timezone] of timezones.entries()) {
      const userId = await createUser(`duetz${index}@example.com`, { timezone });
      await repository.enroll({ userId, variant: "TREATMENT", startedAt });
      timezoneByUserId.set(userId, timezone === "Invalid/Timezone" ? "UTC" : timezone);
    }
    const stages = (
      await db.query.retentionExperimentStage.findMany({ with: { assignment: true } })
    ).map((stage) => ({
      stageId: stage.id,
      stage: stage.stage,
      timezone: timezoneByUserId.get(stage.assignment.userId) ?? "UTC",
    }));
    // 97분 간격으로 9일을 훑어 현지 시각·날짜 경계가 고르게 섞이게 한다
    const dueAts = Array.from(
      { length: Math.floor((9 * 24 * 60) / 97) },
      (_, index) => new Date(startedAt.getTime() + index * 97 * 60_000),
    );

    // When
    const mismatches: string[] = [];
    for (const dueAt of dueAts) {
      const selected = new Set(
        (await repository.findDueStages({ dueAt, limit: 200 })).map(({ stageId }) => stageId),
      );
      for (const stage of stages) {
        const expected = isRetentionStageDue(stage.stage, {
          startedAt,
          now: dueAt,
          timezone: stage.timezone,
        });
        if (selected.has(stage.stageId) !== expected) {
          mismatches.push(`${dueAt.toISOString()} ${stage.timezone} ${stage.stage}`);
        }
      }
    }

    // Then
    expect(mismatches).toEqual([]);
  });

  it("sweep이 실행 사이와 놓친 실행 동안 결정할 때가 된 사용자를 모두 처리한다", async () => {
    // Given: 10:00 KST(01:00Z) 실행 직후 2시간이 차는 D0 사용자들과, 1시간 동안 실행이 멈춘 사이에 찬 사용자
    const firstRun = Temporal.Instant.from("2026-07-15T01:00:00Z");
    const startedAts = [
      "2026-07-14T23:00:30Z",
      "2026-07-14T23:02:00Z",
      "2026-07-14T23:04:59Z",
      "2026-07-14T23:40:00Z",
    ];
    const userIds: string[] = [];
    for (const [index, startedAt] of startedAts.entries()) {
      const userId = await createUser(`sweep${index}@example.com`, { withPushToken: true });
      await repository.enroll({ userId, variant: "TREATMENT", startedAt: new Date(startedAt) });
      userIds.push(userId);
    }
    const clock = new FixedClock(firstRun);
    const publisher = new RecordingNotificationPublisher();
    const sweep = new ProcessRetentionStagesUseCase({
      repository,
      notificationPublisher: publisher,
      config: { enabled: true },
      unitOfWork,
      clock,
      logger: new SilentLogger(),
    });

    // When: 01:00 실행, 01:05 실행, 그 뒤 01:10~01:40 실행을 놓치고 01:45 실행
    await sweep.execute();
    const afterFirst = publisher.published.length;
    clock.advanceBy({ minutes: 5 });
    await sweep.execute();
    const afterSecond = publisher.published.length;
    clock.advanceBy({ minutes: 40 });
    await sweep.execute();

    // Then
    expect([afterFirst, afterSecond, publisher.published.length]).toEqual([0, 3, 4]);
    for (const userId of userIds) {
      const d0 = (await stagesOf(userId)).find(({ stage }) => stage === "D0");
      expect(d0).toMatchObject({ status: "OUTBOXED" });
    }
  });
});
