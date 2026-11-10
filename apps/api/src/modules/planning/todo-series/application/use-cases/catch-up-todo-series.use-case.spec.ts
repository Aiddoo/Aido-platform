import { vi } from "vitest";

import { TodoTitle } from "#api/modules/planning/shared/domain/todo-title.vo";
import { TodoSeriesId } from "#api/modules/planning/todo-series/domain/todo-series-id.vo";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { DateClock } from "#test/doubles/platform/date-clock";
import { createPlanningTodoFixture } from "#test/fixtures/planning/planning-todos.fixture";

import { RepeatRule } from "../../domain/repeat-rule.vo.js";
import { TodoSeries } from "../../domain/todo-series.aggregate.js";
import { TodoSeriesLogEvent } from "../todo-series.log-events.js";
import {
  TODO_SERIES_CATCH_UP_BUDGET,
  CatchUpTodoSeriesUseCase,
} from "./catch-up-todo-series.use-case.js";
import { MaterializeTodoSeriesUseCase } from "./materialize-todo-series.use-case.js";
import { PublishTodoCreationUseCase } from "./publish-todo-creation.use-case.js";

const AT = new Date("2026-11-05T03:00:00.000Z");
const LAST_MOVED_AT = new Date("2026-06-01T00:00:00.000Z");

describe("복귀 회차 채우기", () => {
  let fixture: ReturnType<typeof createPlanningTodoFixture>;
  let dueRunner: MaterializeTodoSeriesUseCase;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(AT);
    fixture = createPlanningTodoFixture();
    dueRunner = new MaterializeTodoSeriesUseCase({
      clock: new DateClock(),
      seriesRepository: fixture.todoSeriesRepository,
      materializer: fixture.occurrenceMaterializer,
      effects: new PublishTodoCreationUseCase(fixture),
      unitOfWork: fixture.unitOfWork,
      mutationLock: fixture.mutationLock,
    });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function catchUp(overrides: { deadlineMs?: number } = {}) {
    return new CatchUpTodoSeriesUseCase({
      clock: new DateClock(),
      seriesRepository: fixture.todoSeriesRepository,
      seriesOwner: fixture.seriesOwner,
      dueRunner,
      logger: fixture.logger,
      ...overrides,
    });
  }

  async function seedStale(id: string, nextOccurrenceDate = "2026-08-30") {
    const series = TodoSeries.reconstitute({
      ...TodoSeries.create({
        id: TodoSeriesId.reconstitute(id),
        userId: UserId.reconstitute(fixture.userId),
        categoryId: 1,
        title: TodoTitle.create("물 마시기"),
        visibility: "PUBLIC",
        scheduledLocalTime: null,
        timezone: "UTC",
        rule: RepeatRule.create({ frequency: "DAILY", end: { type: "NEVER" } }),
        startDate: "2026-03-01",
        checklistTemplate: [],
        now: Temporal.Instant.fromEpochMilliseconds(LAST_MOVED_AT.getTime()),
      }).toPrimitives(),
      nextOccurrenceDate,
    });
    await fixture.todoSeriesRepository.insert(series);
  }

  it("뒤처진 규칙을 오늘부터 채우고 지난 날은 만들지 않는다", async () => {
    // Given
    await seedStale("series-1");
    // When
    await catchUp().execute(fixture.userId);
    // Then
    expect(fixture.records.size).toBe(91);
    const dates = [...fixture.records.values()].map((todo) => todo.occurrenceDate?.toString());
    expect(dates).toContain("2026-11-05");
    expect(dates).not.toContain("2026-11-04");
    expect(fixture.logger.messages).toContainEqual(
      expect.objectContaining({
        event: TodoSeriesLogEvent.CATCH_UP_COMPLETED,
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
    await service.execute(fixture.userId);
    await service.execute(fixture.userId);
    await service.execute(fixture.userId);
    // Then
    expect(findIdsBehind).toHaveBeenCalledOnce();
    expect(fixture.records.size).toBe(0);
    expect(fixture.logger.messages).toEqual([]);
  });

  it("UTC 날짜가 바뀌면 다시 한 번 조회한다", async () => {
    // Given
    const findIdsBehind = vi.spyOn(fixture.todoSeriesRepository, "findIdsBehind");
    const service = catchUp();
    await service.execute(fixture.userId);
    vi.setSystemTime(new Date("2026-11-06T00:00:00.000Z"));
    // When
    await service.execute(fixture.userId);
    // Then
    expect(findIdsBehind).toHaveBeenCalledTimes(2);
    expect(findIdsBehind).toHaveBeenLastCalledWith(fixture.userId, "2026-11-07");
  });

  it("UTC 날짜가 하루 늦은 시간대의 오늘도 조회 범위에 넣는다", async () => {
    // Given
    vi.setSystemTime(new Date("2026-11-04T16:00:00.000Z"));
    const findIdsBehind = vi.spyOn(fixture.todoSeriesRepository, "findIdsBehind");
    // When
    await catchUp().execute(fixture.userId);
    // Then
    expect(findIdsBehind).toHaveBeenCalledWith(fixture.userId, "2026-11-05");
  });

  it("같은 사용자의 동시 요청은 한 번의 복귀를 함께 기다린다", async () => {
    // Given
    await seedStale("series-1");
    const materialize = vi.spyOn(dueRunner, "execute");
    const service = catchUp();
    // When
    await Promise.all([service.execute(fixture.userId), service.execute(fixture.userId)]);
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
    await expect(service.execute(fixture.userId)).resolves.toBeUndefined();
    await service.execute(fixture.userId);
    const callsBeforeRetry = findIdsBehind.mock.calls.length;
    vi.setSystemTime(new Date(AT.getTime() + TODO_SERIES_CATCH_UP_BUDGET.RETRY_AFTER_MS + 1));
    await service.execute(fixture.userId);
    // Then
    expect(callsBeforeRetry).toBe(1);
    expect(findIdsBehind).toHaveBeenCalledTimes(2);
    expect(fixture.logger.messages).toContainEqual(
      expect.objectContaining({
        event: TodoSeriesLogEvent.CATCH_UP_FAILED,
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
    await service.execute(fixture.userId);
    vi.setSystemTime(new Date(AT.getTime() + TODO_SERIES_CATCH_UP_BUDGET.RETRY_AFTER_MS + 1));
    await service.execute(fixture.userId);
    // Then
    expect(spy).toHaveBeenCalledTimes(3);
    expect(fixture.records.size).toBe(182);
    expect(fixture.logger.messages).toContainEqual(
      expect.objectContaining({
        event: TodoSeriesLogEvent.CATCH_UP_FAILED,
        seriesId: expect.any(String),
      }),
    );
  });

  it("시간 상한을 넘으면 멈추고 남은 규칙은 다음 요청이 잇는다", async () => {
    // Given
    await seedStale("series-1");
    const service = catchUp({ deadlineMs: 0 });
    // When
    await service.execute(fixture.userId);
    // Then
    expect(fixture.records.size).toBe(0);
    expect(fixture.logger.messages).toContainEqual(expect.objectContaining({ timedOut: true }));
  });

  it("로그에 제목을 남기지 않는다", async () => {
    // Given
    await seedStale("series-1");
    // When
    await catchUp().execute(fixture.userId);
    // Then
    const calls = JSON.stringify(fixture.logger.messages);
    expect(calls).not.toContain("물 마시기");
  });
});
