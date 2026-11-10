import { SilentLogger } from "#test/doubles/platform/silent-logger";

import { TodoToggledEvent } from "../../../shared/domain/todo-toggled.event.js";
import { TodoUpdatedEvent } from "../../../shared/domain/todo-updated.event.js";
import type { FriendPort } from "../ports/friend.port.js";
import type { StreakPort } from "../ports/streak.port.js";
import type {
  FriendCompletedPayload,
  MilestoneReachedPayload,
  TodoNotificationPort,
} from "../ports/todo-notification.port.js";
import type { TodoReadRepositoryPort } from "../ports/todo-read.repository.port.js";
import { ApplyTodoCompletionEffectsUseCase } from "./apply-todo-completion-effects.use-case.js";

function setUp(options: {
  readonly todayStats: { readonly total: number; readonly completed: number };
  readonly completedCount: number;
  readonly friendIds?: readonly string[];
}) {
  const streakRecords: { userId: string; completed: boolean; timezone: string }[] = [];
  const friendCompleted: FriendCompletedPayload[] = [];
  const milestones: MilestoneReachedPayload[] = [];
  const unused = async (): Promise<never> => {
    throw new Error("이 테스트에서 쓰지 않는 조회다");
  };
  const readRepository: TodoReadRepositoryPort = {
    findByIdAndUserId: unused,
    findOwnerId: unused,
    findManyBySeriesId: unused,
    findManyByUserId: unused,
    findPublicTodosByUserId: unused,
    countCategoryUsage: unused,
    findTodayTopTodos: unused,
    getTodayTodoStats: async () => ({ ...options.todayStats }),
    countCompletedByUser: async () => options.completedCount,
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
    recordTodoToggle: async (userId, completed, timezone) => {
      streakRecords.push({ userId, completed, timezone });
    },
    getStreakContext: async () => ({ currentStreak: 0, lastCompletedDate: null }),
  };
  const useCase = new ApplyTodoCompletionEffectsUseCase({
    todoReadRepository: readRepository,
    friendPort,
    todoNotification: notification,
    streakPort: streak,
    logger: new SilentLogger(),
  });
  return { useCase, streakRecords, friendCompleted, milestones };
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
