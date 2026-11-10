import { InMemoryCacheStore } from "#api/platform/cache/adapters/in-memory-cache.store";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { InMemoryDailyCompletionRepository } from "#test/doubles/insights/in-memory-daily-completion.repository";
import {
  calendarDate,
  createDateRangeFixture,
  createTodoSeedFixture,
  DAILY_COMPLETION_FIXTURE_FRIEND_ID,
  DAILY_COMPLETION_FIXTURE_USER_ID,
} from "#test/fixtures/insights/daily-completion.fixture";

import { DailyCompletionCache } from "../../infrastructure/cache/daily-completion.cache.js";
import type { DailyCompletionRange } from "../read-models/daily-completion-range.read-model.js";
import { GetDailyCompletionsUseCase } from "./get-daily-completions.use-case.js";

const QUERY = {
  userId: DAILY_COMPLETION_FIXTURE_USER_ID,
  startDate: calendarDate("2028-02-01"),
  endDate: calendarDate("2028-02-29"),
};

function summariesOf(result: DailyCompletionRange) {
  return result.completions.map((completion) => ({
    date: completion.date.toString(),
    totalTodos: completion.totalTodos,
    completedTodos: completion.completedTodos,
    isComplete: completion.isComplete,
    completionRate: completion.completionRate,
    categoryColors: completion.categoryColors,
  }));
}

function setup() {
  const dailyCompletionRepository = new InMemoryDailyCompletionRepository();
  const dailyCompletionCache = new DailyCompletionCache(
    new InMemoryCacheStore({ defaultTtlMs: 60_000, maxItems: 100 }),
  );
  const useCase = new GetDailyCompletionsUseCase({
    dailyCompletionRepository,
    dailyCompletionCache,
  });
  return { dailyCompletionRepository, dailyCompletionCache, useCase };
}

describe("GetDailyCompletionsUseCase — 일일 완료 조회", () => {
  it("구간 양끝 날짜를 포함해 날짜별 완료율·색상과 완료일 수를 날짜 오름차순으로 돌려준다", async () => {
    // Given
    const { dailyCompletionRepository, useCase } = setup();
    dailyCompletionRepository.add(
      createTodoSeedFixture({ startDate: calendarDate("2028-02-29"), completed: true }),
      createTodoSeedFixture({
        startDate: calendarDate("2028-02-29"),
        categoryColor: "#654321",
      }),
      createTodoSeedFixture({ startDate: calendarDate("2028-02-01"), completed: true }),
      createTodoSeedFixture({ startDate: calendarDate("2028-01-31"), completed: true }),
      createTodoSeedFixture({ startDate: calendarDate("2028-03-01"), completed: true }),
      createTodoSeedFixture({
        userId: DAILY_COMPLETION_FIXTURE_FRIEND_ID,
        startDate: calendarDate("2028-02-15"),
      }),
    );

    // When
    const result = await useCase.execute(QUERY);

    // Then
    expect(summariesOf(result)).toEqual([
      {
        date: "2028-02-01",
        totalTodos: 1,
        completedTodos: 1,
        isComplete: true,
        completionRate: 100,
        categoryColors: ["#FF6B43"],
      },
      {
        date: "2028-02-29",
        totalTodos: 2,
        completedTodos: 1,
        isComplete: false,
        completionRate: 50,
        categoryColors: ["#654321", "#FF6B43"],
      },
    ]);
    expect(result.totalCompleteDays).toBe(1);
    expect(result.range.equals(createDateRangeFixture("2028-02-01", "2028-02-29"))).toBe(true);
  });

  it("첫 조회를 캐시에 담아 무효화 전에는 할 일이 바뀌어도 같은 결과를 주고 다른 사용자와 섞지 않는다", async () => {
    // Given
    const { dailyCompletionRepository, dailyCompletionCache, useCase } = setup();
    dailyCompletionRepository.add(createTodoSeedFixture({ completed: true }));
    const first = await useCase.execute(QUERY);
    dailyCompletionRepository.clear();

    // When
    const cached = await useCase.execute(QUERY);
    const other = await dailyCompletionCache.readRange(
      UserId.reconstitute(DAILY_COMPLETION_FIXTURE_FRIEND_ID),
      first.range,
    );

    // Then
    expect(summariesOf(cached)).toEqual(summariesOf(first));
    expect(other.value).toBeNull();
  });

  it("구간 앞에서 시작한 여러 날 할 일도 구간 안 기간의 모든 날에 세어 완료일 수에 넣는다", async () => {
    // Given
    const { dailyCompletionRepository, useCase } = setup();
    dailyCompletionRepository.add(
      createTodoSeedFixture({
        startDate: calendarDate("2028-01-30"),
        endDate: calendarDate("2028-02-02"),
        completed: true,
      }),
    );

    // When
    const result = await useCase.execute(QUERY);

    // Then
    expect(summariesOf(result).map(({ date }) => date)).toEqual(["2028-02-01", "2028-02-02"]);
    expect(result.totalCompleteDays).toBe(2);
  });

  it("할 일이 없으면 조회 구간을 그대로 둔 빈 완료 현황을 돌려준다", async () => {
    // Given
    const { useCase } = setup();

    // When
    const result = await useCase.execute(QUERY);

    // Then
    expect(result.completions).toEqual([]);
    expect(result.totalCompleteDays).toBe(0);
    expect(result.range.start.toString()).toBe("2028-02-01");
    expect(result.range.end.toString()).toBe("2028-02-29");
  });

  it("무효화 전에 시작한 늦은 조회는 캐시에 남지 않아 다음 조회가 새 완료 상태를 받는다", async () => {
    // Given
    const { dailyCompletionRepository, dailyCompletionCache, useCase } = setup();
    dailyCompletionRepository.add(createTodoSeedFixture({ completed: false }));
    const held = dailyCompletionRepository.holdNextRead();
    const staleRead = useCase.execute(QUERY);
    await held.entered;

    // When
    await dailyCompletionCache.invalidate(UserId.reconstitute(DAILY_COMPLETION_FIXTURE_USER_ID));
    dailyCompletionRepository.clear();
    dailyCompletionRepository.add(createTodoSeedFixture({ completed: true }));
    held.release();
    const stale = await staleRead;
    const fresh = await useCase.execute(QUERY);

    // Then
    expect(stale.completions[0]?.completedTodos).toBe(0);
    expect(fresh.completions[0]?.completedTodos).toBe(1);
  });
});
