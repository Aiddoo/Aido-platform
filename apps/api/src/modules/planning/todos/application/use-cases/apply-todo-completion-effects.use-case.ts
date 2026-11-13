import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import type { DomainEvent } from "#api/shared/domain/model/domain-event";

import { localDateAt } from "../../../shared/domain/todo-calendar.domain-service.js";
import { TodoToggledEvent } from "../../../shared/domain/todo-toggled.event.js";
import {
  isAllCompletedToday,
  MILESTONE_COMPLETION_COUNT_LIMIT,
  milestoneForCount,
} from "../../domain/todo-completion.domain-service.js";
import type { FriendPort } from "../ports/friend.port.js";
import type { StreakPort, TodayCompletionStats } from "../ports/streak.port.js";
import type { TodoNotificationPort } from "../ports/todo-notification.port.js";
import type { TodoReadRepositoryPort } from "../ports/todo-read.repository.port.js";
import { TodoLogEvent } from "../todos.log-events.js";

export interface ApplyTodoCompletionEffectsDependencies {
  readonly todoReadRepository: Pick<
    TodoReadRepositoryPort,
    "getTodayTodoStats" | "countCompletedByUser"
  >;
  readonly friendPort: Pick<FriendPort, "getMutualFriendIds" | "getUserDisplayName">;
  readonly todoNotification: TodoNotificationPort;
  readonly streakPort: Pick<StreakPort, "recordTodoToggle">;
  readonly clock: ClockPort;
  readonly logger: Pick<ApplicationLoggerPort, "log" | "error">;
}

/**
 * 완료 토글이 커밋된 뒤 다른 Context(스트릭·친구 알림·마일스톤)에 미치는 효과다. 리마인더 취소는 UseCase가
 * 같은 트랜잭션에서 한다. 소유 Context가 내구성 있는 구독으로 옮기기 전까지 커밋 뒤 바로 부르고,
 * 실패는 기록만 하고 할 일 응답에 전파하지 않는다.
 */
export class ApplyTodoCompletionEffectsUseCase {
  readonly #dependencies: ApplyTodoCompletionEffectsDependencies;

  constructor(dependencies: ApplyTodoCompletionEffectsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(events: readonly DomainEvent[]): Promise<void> {
    for (const event of events) {
      if (event instanceof TodoToggledEvent) {
        await this.#apply(event);
      }
    }
  }

  async #apply({ userId, completed, timezone }: TodoToggledEvent): Promise<void> {
    const milestone = completed ? this.#notifyMilestone(userId) : Promise.resolve();
    // 스트릭과 친구 완료 알림이 같은 오늘 현황을 보므로 한 번만 센다
    const todayStats = await this.#readTodayStats(userId, timezone);
    const effects = [milestone, this.#recordStreak(userId, completed, timezone, todayStats)];
    if (completed && todayStats != null) {
      effects.push(this.#notifyFriendsIfAllDone(userId, timezone, todayStats));
    }
    await Promise.all(effects);
  }

  async #readTodayStats(userId: string, timezone: string): Promise<TodayCompletionStats | null> {
    try {
      const date = localDateAt(this.#dependencies.clock.now(), timezone);
      const stats = await this.#dependencies.todoReadRepository.getTodayTodoStats(
        UserId.reconstitute(userId),
        date,
      );
      return { date, ...stats };
    } catch (error) {
      this.#dependencies.logger.error({
        event: TodoLogEvent.TODAY_STATS_FAILED,
        userId,
        errorType: toErrorType(error),
      });
      return null;
    }
  }

  async #recordStreak(
    userId: string,
    completed: boolean,
    timezone: string,
    todayStats: TodayCompletionStats | null,
  ): Promise<void> {
    try {
      await this.#dependencies.streakPort.recordTodoToggle(
        UserId.reconstitute(userId),
        completed,
        timezone,
        todayStats,
      );
    } catch (error) {
      this.#dependencies.logger.error({
        event: TodoLogEvent.STREAK_RECORD_FAILED,
        userId,
        errorType: toErrorType(error),
      });
    }
  }

  async #notifyFriendsIfAllDone(
    userId: string,
    timezone: string,
    todayStats: TodayCompletionStats,
  ): Promise<void> {
    if (!isAllCompletedToday(todayStats)) {
      return;
    }
    try {
      const ownerId = UserId.reconstitute(userId);
      const [friendIds, userName] = await Promise.all([
        this.#dependencies.friendPort.getMutualFriendIds(ownerId),
        this.#dependencies.friendPort.getUserDisplayName(ownerId),
      ]);
      if (friendIds.length === 0) {
        return;
      }
      this.#dependencies.todoNotification.enqueueFriendCompleted({
        friendId: userId,
        friendName: userName,
        notifyUserIds: friendIds,
        timezone,
      });
      this.#dependencies.logger.log({
        event: TodoLogEvent.FRIEND_COMPLETED_ENQUEUED,
        userId,
        count: friendIds.length,
      });
    } catch (error) {
      this.#dependencies.logger.error({
        event: TodoLogEvent.FRIEND_COMPLETED_FAILED,
        userId,
        errorType: toErrorType(error),
      });
    }
  }

  async #notifyMilestone(userId: string): Promise<void> {
    try {
      const milestone = milestoneForCount(
        await this.#dependencies.todoReadRepository.countCompletedByUser(
          UserId.reconstitute(userId),
          MILESTONE_COMPLETION_COUNT_LIMIT,
        ),
      );
      if (milestone == null) {
        return;
      }
      this.#dependencies.todoNotification.enqueueMilestoneReached({ userId, milestone });
    } catch (error) {
      this.#dependencies.logger.error({
        event: TodoLogEvent.MILESTONE_CHECK_FAILED,
        userId,
        errorType: toErrorType(error),
      });
    }
  }
}
