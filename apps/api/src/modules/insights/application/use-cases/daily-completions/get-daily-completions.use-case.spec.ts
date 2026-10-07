import {
  createInsightsFixture,
  createTodoAggregateFixture,
  INSIGHTS_TIME,
} from "#test/fixtures/insights.fixture";

import { GetDailyCompletions } from "./get-daily-completions.use-case.js";

const RANGE = { startDate: "2028-02-01", endDate: "2028-02-29" };

describe("GetDailyCompletions — 일일 완료 조회", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(INSIGHTS_TIME);
  });
  afterEach(() => vi.useRealTimers());

  it("윤년 종료일을 포함하는 반열림 조회로 집계하고 날짜별 완료율·색상·완료일 수를 반환한다", async () => {
    // Given
    const fixture = createInsightsFixture();
    fixture.repository.ownAggregates.set(fixture.userId, [
      createTodoAggregateFixture(),
      createTodoAggregateFixture({
        date: new Date("2028-02-28T00:00:00Z"),
        total: 4,
        completed: 2,
        categoryColors: ["#123456", "#654321"],
      }),
    ]);
    const query = vi.spyOn(fixture.repository, "aggregateByDateRange");
    // When
    const result = await new GetDailyCompletions(fixture).execute({
      userId: fixture.userId,
      ...RANGE,
    });
    // Then
    expect(query).toHaveBeenCalledWith({
      userId: fixture.userId,
      startDate: new Date("2028-02-01T00:00:00Z"),
      endDate: new Date("2028-03-01T00:00:00Z"),
    });
    expect(result).toEqual({
      dateRange: RANGE,
      totalCompleteDays: 1,
      completions: [
        {
          date: "2028-02-28",
          totalTodos: 4,
          completedTodos: 2,
          isComplete: false,
          completionRate: 50,
          categoryColors: ["#123456", "#654321"],
        },
        {
          date: "2028-02-29",
          totalTodos: 3,
          completedTodos: 3,
          isComplete: true,
          completionRate: 100,
          categoryColors: ["#123456"],
        },
      ],
    });
  });

  it("첫 조회를 캐싱한 뒤 저장소 준비 상태가 사라져도 같은 범위 결과를 반환한다", async () => {
    // Given
    const fixture = createInsightsFixture();
    fixture.repository.ownAggregates.set(fixture.userId, [createTodoAggregateFixture()]);
    const useCase = new GetDailyCompletions(fixture);
    const first = await useCase.execute({ userId: fixture.userId, ...RANGE });
    fixture.repository.ownAggregates.clear();
    // When
    const cached = await useCase.execute({ userId: fixture.userId, ...RANGE });
    // Then
    expect(cached).toEqual(first);
    expect(
      (await fixture.cache.readRange(fixture.userId, RANGE.startDate, RANGE.endDate)).value,
    ).toEqual(first);
    expect(
      (await fixture.cache.readRange("other-user", RANGE.startDate, RANGE.endDate)).value,
    ).toBeUndefined();
  });

  it("집계가 없으면 범위를 보존한 빈 완료 현황을 반환한다", async () => {
    // Given
    const fixture = createInsightsFixture();
    // When
    const result = await new GetDailyCompletions(fixture).execute({
      userId: fixture.userId,
      ...RANGE,
    });
    // Then
    expect(result).toEqual({ completions: [], totalCompleteDays: 0, dateRange: RANGE });
  });

  it("진행 중인 오래된 조회는 무효화 이후 캐시에 저장되지 않아 다음 조회가 새 완료 상태를 반환한다", async () => {
    // Given
    const fixture = createInsightsFixture();
    fixture.repository.ownAggregates.set(fixture.userId, [
      createTodoAggregateFixture({ completed: 0 }),
    ]);
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const aggregate = fixture.repository.aggregateByDateRange.bind(fixture.repository);
    vi.spyOn(fixture.repository, "aggregateByDateRange").mockImplementationOnce(async (input) => {
      const snapshot = await aggregate(input);
      entered.resolve();
      await release.promise;
      return snapshot;
    });
    const useCase = new GetDailyCompletions(fixture);
    const staleRead = useCase.execute({ userId: fixture.userId, ...RANGE });
    await Promise.race([
      entered.promise,
      staleRead.then(() => {
        throw new Error("집계 gate 전에 요청이 끝났습니다.");
      }),
    ]);
    // When
    try {
      await fixture.cache.invalidate(fixture.userId);
      fixture.repository.ownAggregates.set(fixture.userId, [createTodoAggregateFixture()]);
    } finally {
      release.resolve();
      await staleRead;
    }
    const fresh = await useCase.execute({ userId: fixture.userId, ...RANGE });
    // Then
    expect((await staleRead).completions[0]?.completedTodos).toBe(0);
    expect(fresh.completions[0]?.completedTodos).toBe(3);
    expect(
      (await fixture.cache.readRange(fixture.userId, RANGE.startDate, RANGE.endDate)).value,
    ).toEqual(fresh);
  });
});
