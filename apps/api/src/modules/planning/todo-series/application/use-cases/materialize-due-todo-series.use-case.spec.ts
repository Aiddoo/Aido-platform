import { vi } from "vitest";

import { TodoTitle } from "#api/modules/planning/shared/domain/todo-title.vo";
import { TodoSeriesId } from "#api/modules/planning/todo-series/domain/todo-series-id.vo";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { DateClock } from "#test/doubles/platform/date-clock";
import { RecordingOperationalAlert } from "#test/doubles/platform/recording-operational-alert";
import { createPlanningTodoFixture } from "#test/fixtures/planning/planning-todos.fixture";

import { RepeatRule } from "../../domain/repeat-rule.vo.js";
import { TodoSeries } from "../../domain/todo-series.aggregate.js";
import { TodoSeriesAlerts } from "../todo-series.alerts.js";
import { MaterializeDueTodoSeriesUseCase } from "./materialize-due-todo-series.use-case.js";
import { MaterializeTodoSeriesUseCase } from "./materialize-todo-series.use-case.js";
import { PublishTodoCreationUseCase } from "./publish-todo-creation.use-case.js";

const AT = new Date("2026-11-05T00:00:00.000Z");

describe("회차 채우기", () => {
  let fixture: ReturnType<typeof createPlanningTodoFixture>;
  let alert: RecordingOperationalAlert;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(AT);
    fixture = createPlanningTodoFixture();
    alert = new RecordingOperationalAlert();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function useCase(overrides: { deadlineMs?: number; batchSize?: number } = {}) {
    return new MaterializeDueTodoSeriesUseCase({
      clock: new DateClock(),
      seriesRepository: fixture.todoSeriesRepository,
      seriesOwner: fixture.seriesOwner,
      dueRunner: new MaterializeTodoSeriesUseCase({
        clock: new DateClock(),
        seriesRepository: fixture.todoSeriesRepository,
        materializer: fixture.occurrenceMaterializer,
        effects: new PublishTodoCreationUseCase(fixture),
        unitOfWork: fixture.unitOfWork,
        mutationLock: fixture.mutationLock,
      }),
      alert,
      logger: fixture.logger,
      ...overrides,
    });
  }

  async function seed(id: string, startDate = "2026-11-05") {
    const series = TodoSeries.create({
      id: TodoSeriesId.reconstitute(id),
      userId: UserId.reconstitute(fixture.userId),
      categoryId: 1,
      title: TodoTitle.create("물 마시기"),
      visibility: "PUBLIC",
      scheduledLocalTime: null,
      timezone: "UTC",
      rule: RepeatRule.create({ frequency: "DAILY", end: { type: "COUNT", count: 3 } }),
      startDate,
      checklistTemplate: [],
      now: Temporal.Instant.fromEpochMilliseconds(AT.getTime()),
    });
    await fixture.todoSeriesRepository.insert(series);
  }

  it("회차를 만들고 커서를 옮기며 다시 돌면 아무것도 만들지 않는다", async () => {
    // Given
    await seed("series-1");
    // When
    const first = await useCase().execute();
    const second = await useCase().execute();
    // Then
    expect(first).toMatchObject({ processedCount: 1, createdCount: 3, failedCount: 0 });
    expect(second).toMatchObject({ processedCount: 0, createdCount: 0 });
    expect(fixture.records.size).toBe(3);
    expect(alert.alerts).toEqual([]);
  });

  it("규칙 하나가 실패해도 다음 규칙을 처리하고 운영 경보를 올린다", async () => {
    // Given
    await seed("series-1");
    await seed("series-2");
    const lockForUpdate = fixture.todoSeriesRepository.lockForUpdate.bind(
      fixture.todoSeriesRepository,
    );
    vi.spyOn(fixture.todoSeriesRepository, "lockForUpdate").mockImplementation(async (id) => {
      if (id.value === "series-1") {
        throw new Error("저장 실패");
      }
      return lockForUpdate(id);
    });
    // When
    const result = await useCase().execute();
    // Then
    expect(result).toMatchObject({ processedCount: 2, createdCount: 3, failedCount: 1 });
    expect(alert.alerts).toEqual([
      expect.objectContaining({
        key: TodoSeriesAlerts.MATERIALIZE_FAILED.key,
      }),
    ]);
  });

  it("커밋 뒤 효과가 실패해도 회차는 남고 그 규칙만 실패로 센다", async () => {
    // Given
    await seed("series-1");
    fixture.todoCache.invalidateFriendTodos = async () => {
      throw new Error("캐시 실패");
    };
    // When
    const result = await useCase().execute();
    // Then
    expect(result).toMatchObject({ failedCount: 1, createdCount: 0 });
    expect(fixture.records.size).toBe(3);
  });

  it("시간 상한을 넘으면 멈추고 남은 규칙은 다음 실행에 맡긴다", async () => {
    // Given
    await seed("series-1");
    // When
    const result = await useCase({ deadlineMs: 0 }).execute();
    // Then
    expect(result).toMatchObject({ processedCount: 0, timedOut: true });
    expect(fixture.records.size).toBe(0);
    expect(alert.alerts).toHaveLength(1);
  });

  it("소유자가 휴면이면 건너뛰고 커서를 그대로 둔다", async () => {
    // Given
    await seed("series-1");
    fixture.seriesOwner.activity = {
      lastActiveAt: Temporal.Instant.from("2026-09-05T00:00:00.000Z"),
      signedUpAt: Temporal.Instant.from("2026-01-01T00:00:00.000Z"),
      timezone: "Asia/Seoul",
    };
    // When
    const result = await useCase().execute();
    // Then
    expect(result).toMatchObject({ processedCount: 0, createdCount: 0, dormantCount: 1 });
    expect(fixture.records.size).toBe(0);
    expect(fixture.seriesStore.get("series-1")?.nextOccurrenceDate).toBe("2026-11-05");
    expect(alert.alerts).toEqual([]);
    expect(fixture.logger.messages).toContainEqual(expect.objectContaining({ dormantCount: 1 }));
  });

  it("휴면 기간이어도 휴면 제외 등급의 규칙은 그대로 채운다", async () => {
    // Given
    await seed("series-1");
    fixture.seriesOwner.activity = {
      lastActiveAt: Temporal.Instant.from("2026-09-05T00:00:00.000Z"),
      signedUpAt: Temporal.Instant.from("2026-01-01T00:00:00.000Z"),
      timezone: "Asia/Seoul",
    };
    fixture.seriesOwner.exemptUserIds.add(fixture.userId);
    // When
    const result = await useCase().execute();
    // Then
    expect(result).toMatchObject({ processedCount: 1, createdCount: 3, dormantCount: 0 });
  });

  it("같은 휴면 소유자의 여러 규칙은 휴면 제외 등급을 한 번만 묻는다", async () => {
    // Given
    await seed("series-1");
    await seed("series-2");
    await seed("series-3");
    fixture.seriesOwner.activity = {
      lastActiveAt: Temporal.Instant.from("2026-09-05T00:00:00.000Z"),
      signedUpAt: Temporal.Instant.from("2026-01-01T00:00:00.000Z"),
      timezone: "Asia/Seoul",
    };
    // When
    const result = await useCase().execute();
    // Then
    expect(result).toMatchObject({ processedCount: 0, dormantCount: 3 });
    expect(fixture.seriesOwner.exemptionChecks).toBe(1);
  });

  it("정지·탈퇴 대기 계정은 건너뛰고 휴면으로도 세지 않는다", async () => {
    // Given
    await seed("series-1");
    fixture.seriesOwner.suspendedUserIds.add(fixture.userId);
    // When
    const result = await useCase().execute();
    // Then
    expect(result).toMatchObject({ processedCount: 0, createdCount: 0, dormantCount: 0 });
  });

  it("휴면 기준일인 60일째까지는 그대로 채운다", async () => {
    // Given
    await seed("series-1");
    fixture.seriesOwner.activity = {
      lastActiveAt: Temporal.Instant.from("2026-09-06T00:00:00.000Z"),
      signedUpAt: Temporal.Instant.from("2026-01-01T00:00:00.000Z"),
      timezone: "Asia/Seoul",
    };
    // When
    const result = await useCase().execute();
    // Then
    expect(result).toMatchObject({ processedCount: 1, createdCount: 3, dormantCount: 0 });
  });
});
