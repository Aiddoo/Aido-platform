import { createPlanningTodoFixture } from "#test/fixtures/planning/planning-todos.fixture";
import { createTodoSeriesFixture } from "#test/fixtures/planning/todo-series.fixture";

import { GetTodoOverviewUseCase } from "./get-todo-overview.use-case.js";

function createGetTodoOverviewUseCase(
  fixture: ReturnType<typeof createPlanningTodoFixture>,
  overrides: Partial<ConstructorParameters<typeof GetTodoOverviewUseCase>[0]> = {},
) {
  return new GetTodoOverviewUseCase({
    todoReadRepository: fixture.todoReadRepository,
    seriesRepository: fixture.seriesRepository,
    seriesCatchUp: fixture.seriesCatchUp,
    ...overrides,
  });
}

describe("GetTodoOverviewUseCase — 할 일 개요", () => {
  it("복귀 처리가 휴면 중 끝난 반복을 닫은 뒤에 읽어 진행 중으로 답하지 않는다", async () => {
    // Given
    const fixture = createPlanningTodoFixture();
    const series = createTodoSeriesFixture({
      userId: fixture.userId,
      startDate: "2026-01-01",
      rule: {
        frequency: "DAILY",
        interval: 1,
        weekdays: null,
        monthDay: null,
        end: { type: "UNTIL", date: "2026-03-31" },
      },
      nextOccurrenceDate: "2026-01-20",
    });
    fixture.seriesStore.set(series.id.value, series);
    const useCase = createGetTodoOverviewUseCase(fixture, {
      seriesCatchUp: {
        execute: async () => {
          series.stopAfter("2026-03-31");
        },
      },
    });

    // When
    const overview = await useCase.execute({ userId: fixture.userId });

    // Then
    expect(overview.hasActiveRepeat).toBe(false);
  });

  it("휴면으로 멈춘 반복은 커서가 남아 있어 진행 중으로 답한다", async () => {
    // Given
    const fixture = createPlanningTodoFixture();
    const series = createTodoSeriesFixture({
      userId: fixture.userId,
      startDate: "2026-01-01",
      nextOccurrenceDate: "2026-01-20",
    });
    fixture.seriesStore.set(series.id.value, series);
    const useCase = createGetTodoOverviewUseCase(fixture);

    // When
    const overview = await useCase.execute({ userId: fixture.userId });

    // Then
    expect(overview).toEqual({ hasTodo: false, hasCompletedTodo: false, hasActiveRepeat: true });
  });
});
