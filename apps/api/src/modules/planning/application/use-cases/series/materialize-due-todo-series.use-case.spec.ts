import { vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { OperationalAlertPort } from "#api/shared/application/ports/operational-alert.port";
import { createPlanningTodoFixture } from "#test/fixtures/planning-todo.fixture";

import { TodoSeries } from "../../../domain/aggregates/series/todo-series.aggregate.js";
import { RepeatRule } from "../../../domain/value-objects/series/repeat-rule.vo.js";
import { TodoSeriesDueRun } from "../../services/series/todo-series-due-run.service.js";
import { TodoCreationEffects } from "../../services/todos/todo-creation-effects.service.js";
import {
  MaterializeDueTodoSeries,
  TODO_SERIES_MATERIALIZE_ALERT_KEY,
} from "./materialize-due-todo-series.use-case.js";

const AT = new Date("2026-11-05T00:00:00.000Z");

describe("회차 채우기", () => {
  let fixture: ReturnType<typeof createPlanningTodoFixture>;
  let alert: ReturnType<typeof mock<OperationalAlertPort>>;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(AT);
    fixture = createPlanningTodoFixture();
    alert = mock<OperationalAlertPort>();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function useCase(overrides: { deadlineMs?: number; batchSize?: number } = {}) {
    return new MaterializeDueTodoSeries({
      seriesRepository: fixture.todoSeriesRepository,
      dueRun: new TodoSeriesDueRun({
        seriesRepository: fixture.todoSeriesRepository,
        materializer: fixture.occurrenceMaterializer,
        effects: new TodoCreationEffects(fixture),
        unitOfWork: fixture.unitOfWork,
        mutationLock: fixture.mutationLock,
      }),
      alert,
      logger: fixture.logger,
      ...overrides,
    });
  }

  async function seed(id: string, startDate = "2026-11-05") {
    const series = TodoSeries.planCreation({
      id,
      userId: fixture.userId,
      categoryId: 1,
      title: "물 마시기",
      visibility: "PUBLIC",
      scheduledLocalTime: null,
      timezone: "UTC",
      rule: RepeatRule.daily({ type: "COUNT", count: 3 }),
      startDate,
      checklistTemplate: [],
      sortOrder: 0,
      at: AT,
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
    expect(alert.raise).not.toHaveBeenCalled();
  });

  it("규칙 하나가 실패해도 다음 규칙을 처리하고 운영 경보를 올린다", async () => {
    // Given
    await seed("series-1");
    await seed("series-2");
    const lockForUpdate = fixture.todoSeriesRepository.lockForUpdate.bind(
      fixture.todoSeriesRepository,
    );
    vi.spyOn(fixture.todoSeriesRepository, "lockForUpdate").mockImplementation(async (id) => {
      if (id === "series-1") {
        throw new Error("저장 실패");
      }
      return lockForUpdate(id);
    });
    // When
    const result = await useCase().execute();
    // Then
    expect(result).toMatchObject({ processedCount: 2, createdCount: 3, failedCount: 1 });
    expect(alert.raise).toHaveBeenCalledWith(
      expect.objectContaining({ key: TODO_SERIES_MATERIALIZE_ALERT_KEY, severity: "error" }),
    );
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
    expect(alert.raise).toHaveBeenCalledOnce();
  });

  it("소유자가 휴면이면 건너뛰고 커서를 그대로 둔다", async () => {
    // Given
    await seed("series-1");
    fixture.todoSeriesRepository.ownerActivity = {
      lastActiveAt: new Date("2026-09-05T00:00:00.000Z"),
      signedUpAt: new Date("2026-01-01T00:00:00.000Z"),
      timezone: "Asia/Seoul",
    };
    // When
    const result = await useCase().execute();
    // Then
    expect(result).toMatchObject({ processedCount: 0, createdCount: 0, dormantCount: 1 });
    expect(fixture.records.size).toBe(0);
    expect(fixture.seriesStore.get("series-1")?.getNextOccurrenceDate()).toBe("2026-11-05");
    expect(alert.raise).not.toHaveBeenCalled();
    expect(fixture.logger.log).toHaveBeenCalledWith(expect.objectContaining({ dormantCount: 1 }));
  });

  it("휴면 기준일인 60일째까지는 그대로 채운다", async () => {
    // Given
    await seed("series-1");
    fixture.todoSeriesRepository.ownerActivity = {
      lastActiveAt: new Date("2026-09-06T00:00:00.000Z"),
      signedUpAt: new Date("2026-01-01T00:00:00.000Z"),
      timezone: "Asia/Seoul",
    };
    // When
    const result = await useCase().execute();
    // Then
    expect(result).toMatchObject({ processedCount: 1, createdCount: 3, dormantCount: 0 });
  });
});
