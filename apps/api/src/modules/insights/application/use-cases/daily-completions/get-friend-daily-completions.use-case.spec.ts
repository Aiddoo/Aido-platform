import {
  createInsightsFixture,
  createTodoAggregateFixture,
  INSIGHTS_TIME,
} from "#test/fixtures/insights.fixture";

import { GetDailyCompletions } from "./get-daily-completions.use-case.js";
import { GetFriendDailyCompletions } from "./get-friend-daily-completions.use-case.js";

const RANGE = { startDate: "2028-02-01", endDate: "2028-02-29" };

describe("GetFriendDailyCompletions — 친구 공개 완료 조회", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(INSIGHTS_TIME);
  });
  afterEach(() => vi.useRealTimers());

  it("맞팔 친구 소유의 PUBLIC 집계만 종료일을 포함해 조회하고 자신의 집계와 캐시를 분리한다", async () => {
    // Given
    const fixture = createInsightsFixture();
    fixture.repository.publicAggregates.set(fixture.userId, [
      createTodoAggregateFixture({ total: 2, completed: 2 }),
    ]);
    fixture.repository.ownAggregates.set(fixture.userId, [
      createTodoAggregateFixture({ total: 5, completed: 4 }),
    ]);
    const publicQuery = vi.spyOn(fixture.repository, "aggregatePublicByDateRange");
    // When
    const own = await new GetDailyCompletions(fixture).execute({
      userId: fixture.userId,
      ...RANGE,
    });
    const result = await new GetFriendDailyCompletions(fixture).execute({
      userId: fixture.viewerId,
      friendUserId: fixture.userId,
      ...RANGE,
    });
    fixture.repository.publicAggregates.clear();
    const cached = await new GetFriendDailyCompletions(fixture).execute({
      userId: fixture.viewerId,
      friendUserId: fixture.userId,
      ...RANGE,
    });
    // Then
    expect(publicQuery).toHaveBeenCalledTimes(1);
    expect(publicQuery).toHaveBeenCalledWith({
      userId: fixture.userId,
      startDate: new Date("2028-02-01T00:00:00Z"),
      endDate: new Date("2028-03-01T00:00:00Z"),
    });
    expect(result.completions[0]).toMatchObject({
      totalTodos: 2,
      completedTodos: 2,
      isComplete: true,
      completionRate: 100,
    });
    expect(result.totalCompleteDays).toBe(1);
    expect(own.completions[0]).toMatchObject({
      totalTodos: 5,
      completedTodos: 4,
      completionRate: 80,
    });
    expect(cached).toEqual(result);
    expect(
      (await fixture.cache.readPublicRange(fixture.viewerId, RANGE.startDate, RANGE.endDate)).value,
    ).toBeUndefined();
  });

  it("공개 결과가 캐시에 있어도 맞팔 해제 후에는 권한 오류가 날짜 파싱보다 우선한다", async () => {
    // Given
    const fixture = createInsightsFixture();
    fixture.repository.publicAggregates.set(fixture.userId, [createTodoAggregateFixture()]);
    const useCase = new GetFriendDailyCompletions(fixture);
    await useCase.execute({ userId: fixture.viewerId, friendUserId: fixture.userId, ...RANGE });
    fixture.followReader.mutualPairs.clear();
    // When
    const execution = useCase.execute({
      userId: fixture.viewerId,
      friendUserId: fixture.userId,
      startDate: "invalid",
      endDate: "invalid",
    });
    // Then
    await expect(execution).rejects.toMatchObject({
      errorCode: "FOLLOW_0906",
      details: { targetUserId: fixture.userId },
    });
    expect(
      (await fixture.cache.readPublicRange(fixture.userId, RANGE.startDate, RANGE.endDate)).value
        ?.completions,
    ).toHaveLength(1);
  });

  it("무효화와 겹친 이전 PUBLIC 조회도 이후 공개 캐시를 덮어쓰지 않는다", async () => {
    // Given
    const fixture = createInsightsFixture();
    fixture.repository.publicAggregates.set(fixture.userId, [
      createTodoAggregateFixture({ completed: 0 }),
    ]);
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const aggregate = fixture.repository.aggregatePublicByDateRange.bind(fixture.repository);
    vi.spyOn(fixture.repository, "aggregatePublicByDateRange").mockImplementationOnce(
      async (input) => {
        const snapshot = await aggregate(input);
        entered.resolve();
        await release.promise;
        return snapshot;
      },
    );
    const useCase = new GetFriendDailyCompletions(fixture);
    const input = { userId: fixture.viewerId, friendUserId: fixture.userId, ...RANGE };
    const staleRead = useCase.execute(input);
    await Promise.race([
      entered.promise,
      staleRead.then(() => {
        throw new Error("집계 gate 전에 요청이 끝났습니다.");
      }),
    ]);
    // When
    try {
      await fixture.cache.invalidate(fixture.userId);
      fixture.repository.publicAggregates.set(fixture.userId, [createTodoAggregateFixture()]);
    } finally {
      release.resolve();
      await staleRead;
    }
    const fresh = await useCase.execute(input);
    // Then
    expect((await staleRead).completions[0]?.completedTodos).toBe(0);
    expect(fresh.completions[0]?.completedTodos).toBe(3);
  });
});
