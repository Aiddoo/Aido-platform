import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { SilentLogger } from "#test/doubles/platform/silent-logger";

import { TodoToggledEvent } from "../../../shared/domain/todo-toggled.event.js";
import { TodoUpdatedEvent } from "../../../shared/domain/todo-updated.event.js";
import type { FriendPort } from "../ports/friend.port.js";
import type { StreakPort, TodayCompletionStats } from "../ports/streak.port.js";
import type {
  FriendCompletedPayload,
  MilestoneReachedPayload,
  TodoNotificationPort,
} from "../ports/todo-notification.port.js";
import type { TodoReadRepositoryPort } from "../ports/todo-read.repository.port.js";
import { TodoLogEvent } from "../todos.log-events.js";
import { ApplyTodoCompletionEffectsUseCase } from "./apply-todo-completion-effects.use-case.js";

function setUp(options: {
  readonly todayStats: { readonly total: number; readonly completed: number } | Error;
  readonly completedCount: number;
  readonly friendIds?: readonly string[];
}) {
  const streakRecords: { userId: string; completed: boolean; timezone: string }[] = [];
  const streakTodayStats: (TodayCompletionStats | null)[] = [];
  const todayStatsReads: Temporal.PlainDate[] = [];
  const logger = new SilentLogger();
  const friendCompleted: FriendCompletedPayload[] = [];
  const milestones: MilestoneReachedPayload[] = [];
  const unused = async (): Promise<never> => {
    throw new Error("이 테스트에서 쓰지 않는 조회다");
  };
  const readRepository: TodoReadRepositoryPort = {
    findByIdAndUserId: unused,
    findOwnerIds: unused,
    findManyBySeriesId: unused,
    findManyByUserId: unused,
    findPublicTodosByUserId: unused,
    countCategoryUsage: unused,
    existsByUserId: unused,
    existsCompletedByUserId: unused,
    findTodayTopTodos: unused,
    getTodayTodoStats: async (_userId, today) => {
      todayStatsReads.push(today);
      if (options.todayStats instanceof Error) {
        throw options.todayStats;
      }
      return { ...options.todayStats };
    },
    countCompletedByUser: async (_userId, limit) => Math.min(options.completedCount, limit),
  };
  const friendPort: FriendPort = {
    isMutualFriend: async () => true,
    getMutualFriendIds: async () => [...(options.friendIds ?? [])],
    getUserDisplayName: async () => "홍길동",
  };
  const notification: TodoNotificationPort = {
    enqueueFriendCompleted: (payload) => {
      friendCompleted.push(payload);
    },
    enqueueMilestoneReached: (payload) => {
      milestones.push(payload);
    },
  };
  const streak: StreakPort = {
    recordTodoToggle: async (userId, completed, timezone, todayStats) => {
      streakRecords.push({ userId: userId.value, completed, timezone });
      streakTodayStats.push(todayStats);
    },
    getStreakContext: async () => ({ currentStreak: 0, lastCompletedDate: null }),
  };
  const useCase = new ApplyTodoCompletionEffectsUseCase({
    todoReadRepository: readRepository,
    friendPort,
    todoNotification: notification,
    streakPort: streak,
    clock: new FixedClock(Temporal.Instant.from("2026-11-10T03:00:00Z")),
    logger,
  });
  return {
    useCase,
    streakRecords,
    streakTodayStats,
    todayStatsReads,
    friendCompleted,
    milestones,
    logger,
  };
}

describe("ApplyTodoCompletionEffectsUseCase — 완료 토글 뒤 다른 Context 효과", () => {
  it("완료하면 스트릭을 기록하고 리마인더는 건드리지 않는다(취소는 UseCase 트랜잭션 몫)", async () => {
    // Given
    const { useCase, streakRecords } = setUp({
      todayStats: { total: 2, completed: 1 },
      completedCount: 5,
    });

    // When
    await useCase.execute([new TodoToggledEvent(1, "user-1", true, "UTC")]);

    // Then
    expect(streakRecords).toEqual([{ userId: "user-1", completed: true, timezone: "UTC" }]);
  });

  it("오늘 할 일을 모두 끝내면 맞팔 친구에게 완료 알림을 넣는다", async () => {
    // Given
    const { useCase, friendCompleted } = setUp({
      todayStats: { total: 3, completed: 3 },
      completedCount: 7,
      friendIds: ["friend-1"],
    });

    // When
    await useCase.execute([new TodoToggledEvent(1, "user-1", true, "Asia/Seoul")]);

    // Then
    expect(friendCompleted).toEqual([
      {
        friendId: "user-1",
        friendName: "홍길동",
        notifyUserIds: ["friend-1"],
        timezone: "Asia/Seoul",
      },
    ]);
  });

  it("누적 완료 수가 마일스톤이면 마일스톤 알림을 넣는다", async () => {
    // Given
    const { useCase, milestones } = setUp({
      todayStats: { total: 2, completed: 1 },
      completedCount: 10,
    });

    // When
    await useCase.execute([new TodoToggledEvent(1, "user-1", true, "UTC")]);

    // Then
    expect(milestones).toEqual([{ userId: "user-1", milestone: "COUNT_10" }]);
  });

  it("스트릭과 친구 완료 알림은 오늘 현황을 한 번만 세서 함께 쓴다", async () => {
    // Given
    const { useCase, streakTodayStats, todayStatsReads, friendCompleted } = setUp({
      todayStats: { total: 3, completed: 3 },
      completedCount: 7,
      friendIds: ["friend-1"],
    });

    // When
    await useCase.execute([new TodoToggledEvent(1, "user-1", true, "Asia/Seoul")]);

    // Then
    const today = Temporal.PlainDate.from("2026-11-10");
    expect(todayStatsReads).toEqual([today]);
    expect(streakTodayStats).toEqual([{ date: today, total: 3, completed: 3 }]);
    expect(friendCompleted).toHaveLength(1);
  });

  it("오늘 현황을 읽지 못하면 스트릭은 현황 없이 기록하고 친구 완료 알림은 넣지 않는다", async () => {
    // Given
    const { useCase, streakTodayStats, friendCompleted, milestones, logger } = setUp({
      todayStats: new Error("DB 연결 끊김"),
      completedCount: 10,
      friendIds: ["friend-1"],
    });

    // When
    await useCase.execute([new TodoToggledEvent(1, "user-1", true, "UTC")]);

    // Then
    expect(streakTodayStats).toEqual([null]);
    expect(friendCompleted).toEqual([]);
    expect(milestones).toEqual([{ userId: "user-1", milestone: "COUNT_10" }]);
    expect(logger.messages).toContainEqual({
      event: TodoLogEvent.TODAY_STATS_FAILED,
      userId: "user-1",
      errorType: "Error",
    });
  });

  it.each([
    { completedCount: 99, expected: [] },
    { completedCount: 100, expected: [{ userId: "user-1", milestone: "COUNT_100" }] },
    { completedCount: 101, expected: [] },
    { completedCount: 5000, expected: [] },
  ])(
    "누적 완료 $completedCount개는 상한까지만 세어도 마일스톤 판정이 같다",
    async ({ completedCount, expected }) => {
      // Given
      const { useCase, milestones } = setUp({
        todayStats: { total: 2, completed: 1 },
        completedCount,
      });

      // When
      await useCase.execute([new TodoToggledEvent(1, "user-1", true, "UTC")]);

      // Then
      expect(milestones).toEqual(expected);
    },
  );

  it("미완료로 되돌리면 스트릭만 다시 계산하고 알림은 넣지 않는다", async () => {
    // Given
    const { useCase, streakRecords, friendCompleted, milestones } = setUp({
      todayStats: { total: 1, completed: 1 },
      completedCount: 10,
      friendIds: ["friend-1"],
    });

    // When
    await useCase.execute([new TodoToggledEvent(1, "user-1", false, "UTC")]);

    // Then
    expect(streakRecords).toEqual([{ userId: "user-1", completed: false, timezone: "UTC" }]);
    expect(friendCompleted).toEqual([]);
    expect(milestones).toEqual([]);
  });

  it("완료 토글이 아닌 사실은 효과를 내지 않는다", async () => {
    // Given
    const { useCase, streakRecords, milestones } = setUp({
      todayStats: { total: 1, completed: 1 },
      completedCount: 10,
    });

    // When
    await useCase.execute([new TodoUpdatedEvent(1, "user-1", true)]);

    // Then
    expect(streakRecords).toEqual([]);
    expect(milestones).toEqual([]);
  });
});
