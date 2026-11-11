import { InMemoryCacheStore } from "#api/platform/cache/adapters/in-memory-cache.store";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { InMemoryDailyCompletionRepository } from "#test/doubles/insights/in-memory-daily-completion.repository";
import { StubFriendshipReader } from "#test/doubles/insights/stub-friendship.reader";
import {
  calendarDate,
  createTodoSeedFixture,
  DAILY_COMPLETION_FIXTURE_FRIEND_ID,
  DAILY_COMPLETION_FIXTURE_USER_ID,
} from "#test/fixtures/insights/daily-completion.fixture";

import { DailyCompletionCache } from "../../infrastructure/cache/daily-completion.cache.js";
import { GetFriendDailyCompletionsUseCase } from "./get-friend-daily-completions.use-case.js";

const VIEWER_ID = DAILY_COMPLETION_FIXTURE_USER_ID;
const FRIEND_ID = DAILY_COMPLETION_FIXTURE_FRIEND_ID;
const QUERY = {
  userId: VIEWER_ID,
  friendUserId: FRIEND_ID,
  startDate: calendarDate("2028-02-01"),
  endDate: calendarDate("2028-02-29"),
};

function setup() {
  const dailyCompletionRepository = new InMemoryDailyCompletionRepository();
  const dailyCompletionCache = new DailyCompletionCache(
    new InMemoryCacheStore({ defaultTtlMs: 60_000, maxItems: 100 }),
  );
  const friendshipReader = new StubFriendshipReader();
  friendshipReader.addMutualFriends(VIEWER_ID, FRIEND_ID);
  const useCase = new GetFriendDailyCompletionsUseCase({
    dailyCompletionRepository,
    dailyCompletionCache,
    friendshipReader,
  });
  return { dailyCompletionRepository, dailyCompletionCache, friendshipReader, useCase };
}

describe("GetFriendDailyCompletionsUseCase — 친구 공개 완료 조회", () => {
  it("맞팔 친구의 공개 할 일만 구간 끝날까지 세고 본인 조회 캐시와 나눠 담는다", async () => {
    // Given
    const { dailyCompletionRepository, dailyCompletionCache, useCase } = setup();
    dailyCompletionRepository.add(
      createTodoSeedFixture({ userId: FRIEND_ID, completed: true }),
      createTodoSeedFixture({ userId: FRIEND_ID, completed: false, isPublic: false }),
      createTodoSeedFixture({ userId: VIEWER_ID, completed: false }),
    );

    // When
    const result = await useCase.execute(QUERY);
    const friendOwnCache = await dailyCompletionCache.readRange(
      UserId.reconstitute(FRIEND_ID),
      result.range,
    );

    // Then
    expect(
      result.completions.map((completion) => [
        completion.date.toString(),
        completion.totalTodos,
        completion.completedTodos,
      ]),
    ).toEqual([["2028-02-29", 1, 1]]);
    expect(result.totalCompleteDays).toBe(1);
    expect(friendOwnCache.value).toBeNull();
  });

  it("공개 결과가 캐시에 있어도 맞팔이 끊기면 FOLLOW_0906으로 거절한다", async () => {
    // Given
    const { dailyCompletionRepository, dailyCompletionCache, useCase } = setup();
    dailyCompletionRepository.add(createTodoSeedFixture({ userId: FRIEND_ID, completed: true }));
    await useCase.execute(QUERY);
    const withoutFriendship = new GetFriendDailyCompletionsUseCase({
      dailyCompletionRepository,
      dailyCompletionCache,
      friendshipReader: new StubFriendshipReader(),
    });

    // When
    const execution = withoutFriendship.execute(QUERY);

    // Then
    await expect(execution).rejects.toMatchObject({
      errorCode: "FOLLOW_0906",
      details: { targetUserId: FRIEND_ID },
    });
  });

  it("무효화와 겹친 늦은 공개 조회도 이후 공개 캐시를 덮어쓰지 않는다", async () => {
    // Given
    const { dailyCompletionRepository, dailyCompletionCache, useCase } = setup();
    dailyCompletionRepository.add(createTodoSeedFixture({ userId: FRIEND_ID, completed: false }));
    const held = dailyCompletionRepository.holdNextRead();
    const staleRead = useCase.execute(QUERY);
    await held.entered;

    // When
    await dailyCompletionCache.invalidate(UserId.reconstitute(FRIEND_ID));
    dailyCompletionRepository.clear();
    dailyCompletionRepository.add(createTodoSeedFixture({ userId: FRIEND_ID, completed: true }));
    held.release();
    const stale = await staleRead;
    const fresh = await useCase.execute(QUERY);

    // Then
    expect(stale.completions[0]?.completedTodos).toBe(0);
    expect(fresh.completions[0]?.completedTodos).toBe(1);
  });
});
