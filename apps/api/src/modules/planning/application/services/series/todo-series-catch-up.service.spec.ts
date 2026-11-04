import { vi } from "vitest";

import { createPlanningTodoFixture } from "#test/fixtures/planning-todo.fixture";

import { TodoSeries } from "../../../domain/aggregates/series/todo-series.aggregate.js";
import { RepeatRule } from "../../../domain/value-objects/series/repeat-rule.vo.js";
import { PlanningTodoSeriesLogEvent } from "../../observability/series/planning-todo-series-log.events.js";
import { TodoCreationEffects } from "../todos/todo-creation-effects.service.js";
import { TODO_SERIES_CATCH_UP_BUDGET, TodoSeriesCatchUp } from "./todo-series-catch-up.service.js";
import { TodoSeriesDueRun } from "./todo-series-due-run.service.js";

const AT = new Date("2026-11-05T03:00:00.000Z");
const LAST_MOVED_AT = new Date("2026-06-01T00:00:00.000Z");

describe("복귀 회차 채우기", () => {
  let fixture: ReturnType<typeof createPlanningTodoFixture>;
  let dueRun: TodoSeriesDueRun;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(AT);
    fixture = createPlanningTodoFixture();
    dueRun = new TodoSeriesDueRun({
      seriesRepository: fixture.todoSeriesRepository,
      materializer: fixture.occurrenceMaterializer,
      effects: new TodoCreationEffects(fixture),
      unitOfWork: fixture.unitOfWork,
      mutationLock: fixture.mutationLock,
    });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function catchUp(overrides: { deadlineMs?: number } = {}) {
    return new TodoSeriesCatchUp({
      seriesRepository: fixture.todoSeriesRepository,
      seriesOwner: fixture.seriesOwner,
      dueRun,
      logger: fixture.logger,
      ...overrides,
    });
  }

  async function seedStale(id: string, nextOccurrenceDate = "2026-08-30") {
    const series = TodoSeries.reconstitute({
      ...TodoSeries.planCreation({
        id,
        userId: fixture.userId,
        categoryId: 1,
        title: "물 마시기",
        visibility: "PUBLIC",
        scheduledLocalTime: null,
        timezone: "UTC",
        rule: RepeatRule.daily({ type: "NEVER" }),
        startDate: "2026-03-01",
        checklistTemplate: [],
        at: LAST_MOVED_AT,
      }).toPersistence(),
      nextOccurrenceDate,
    });
    await fixture.todoSeriesRepository.insert(series);
  }

  it("뒤처진 규칙을 오늘부터 채우고 지난 날은 만들지 않는다", async () => {
    // Given
    await seedStale("series-1");
    // When
    await catchUp().ensureCaughtUp(fixture.userId);
    // Then
    expect(fixture.records.size).toBe(91);
    const dates = [...fixture.records.values()].map((todo) =>
      todo.occurrenceDate?.toISOString().slice(0, 10),
    );
    expect(dates).toContain("2026-11-05");
    expect(dates).not.toContain("2026-11-04");
    expect(fixture.logger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        event: PlanningTodoSeriesLogEvent.CATCH_UP_COMPLETED,
        seriesCount: 1,
        createdCount: 91,
      }),
    );
  });

  it("커서가 앞서 있으면 쓰지 않고 같은 날 다시 조회하지 않는다", async () => {
    // Given
    await seedStale("series-1", "2027-02-04");
    const findIdsBehind = vi.spyOn(fixture.todoSeriesRepository, "findIdsBehind");
    const service = catchUp();
    // When
    await service.ensureCaughtUp(fixture.userId);
    await service.ensureCaughtUp(fixture.userId);
    await service.ensureCaughtUp(fixture.userId);
    // Then
    expect(findIdsBehind).toHaveBeenCalledOnce();
    expect(fixture.records.size).toBe(0);
    expect(fixture.logger.log).not.toHaveBeenCalled();
  });

  it("UTC 날짜가 바뀌면 다시 한 번 조회한다", async () => {
    // Given
    const findIdsBehind = vi.spyOn(fixture.todoSeriesRepository, "findIdsBehind");
    const service = catchUp();
    await service.ensureCaughtUp(fixture.userId);
    vi.setSystemTime(new Date("2026-11-06T00:00:00.000Z"));
    // When
    await service.ensureCaughtUp(fixture.userId);
    // Then
    expect(findIdsBehind).toHaveBeenCalledTimes(2);
    expect(findIdsBehind).toHaveBeenLastCalledWith(fixture.userId, "2026-11-07");
  });

  it("UTC 날짜가 하루 늦은 시간대의 오늘도 조회 범위에 넣는다", async () => {
    // Given
    vi.setSystemTime(new Date("2026-11-04T16:00:00.000Z"));
    const findIdsBehind = vi.spyOn(fixture.todoSeriesRepository, "findIdsBehind");
    // When
    await catchUp().ensureCaughtUp(fixture.userId);
    // Then
    expect(findIdsBehind).toHaveBeenCalledWith(fixture.userId, "2026-11-05");
  });

  it("같은 사용자의 동시 요청은 한 번의 복귀를 함께 기다린다", async () => {
    // Given
    await seedStale("series-1");
    const materialize = vi.spyOn(dueRun, "materialize");
    const service = catchUp();
    // When
    await Promise.all([
      service.ensureCaughtUp(fixture.userId),
      service.ensureCaughtUp(fixture.userId),
    ]);
    // Then
    expect(materialize).toHaveBeenCalledOnce();
    expect(fixture.records.size).toBe(91);
  });

  it("조회가 실패해도 요청으로 전파하지 않고 잠시 뒤 다시 시도한다", async () => {
    // Given
    const findIdsBehind = vi
      .spyOn(fixture.todoSeriesRepository, "findIdsBehind")
      .mockRejectedValueOnce(new Error("연결 실패"));
    const service = catchUp();
    // When
    await expect(service.ensureCaughtUp(fixture.userId)).resolves.toBeUndefined();
    await service.ensureCaughtUp(fixture.userId);
    const callsBeforeRetry = findIdsBehind.mock.calls.length;
    vi.setSystemTime(new Date(AT.getTime() + TODO_SERIES_CATCH_UP_BUDGET.RETRY_AFTER_MS + 1));
    await service.ensureCaughtUp(fixture.userId);
    // Then
    expect(callsBeforeRetry).toBe(1);
    expect(findIdsBehind).toHaveBeenCalledTimes(2);
    expect(fixture.logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: PlanningTodoSeriesLogEvent.CATCH_UP_FAILED,
        errorType: "Error",
      }),
    );
  });

  it("규칙 하나가 실패해도 나머지를 채우고 실패한 규칙만 다음에 다시 시도한다", async () => {
    // Given
    await seedStale("series-1");
    await seedStale("series-2");
    const persist = fixture.occurrenceMaterializer.persist.bind(fixture.occurrenceMaterializer);
    const spy = vi
      .spyOn(fixture.occurrenceMaterializer, "persist")
      .mockImplementationOnce(async () => {
        throw new Error("카테고리 없음");
      })
      .mockImplementation(persist);
    const service = catchUp();
    // When
    await service.ensureCaughtUp(fixture.userId);
    vi.setSystemTime(new Date(AT.getTime() + TODO_SERIES_CATCH_UP_BUDGET.RETRY_AFTER_MS + 1));
    await service.ensureCaughtUp(fixture.userId);
    // Then
    expect(spy).toHaveBeenCalledTimes(3);
    expect(fixture.records.size).toBe(182);
    expect(fixture.logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: PlanningTodoSeriesLogEvent.CATCH_UP_FAILED,
        seriesId: expect.any(String),
      }),
    );
  });

  it("시간 상한을 넘으면 멈추고 남은 규칙은 다음 요청이 잇는다", async () => {
    // Given
    await seedStale("series-1");
    const service = catchUp({ deadlineMs: 0 });
    // When
    await service.ensureCaughtUp(fixture.userId);
    // Then
    expect(fixture.records.size).toBe(0);
    expect(fixture.logger.log).toHaveBeenCalledWith(expect.objectContaining({ timedOut: true }));
  });

  it("로그에 제목을 남기지 않는다", async () => {
    // Given
    await seedStale("series-1");
    // When
    await catchUp().ensureCaughtUp(fixture.userId);
    // Then
    const calls = JSON.stringify([
      vi.mocked(fixture.logger.log).mock.calls,
      vi.mocked(fixture.logger.warn).mock.calls,
    ]);
    expect(calls).not.toContain("물 마시기");
  });
});
