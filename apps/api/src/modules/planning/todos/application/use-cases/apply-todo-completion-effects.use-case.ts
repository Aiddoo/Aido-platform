import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";
import { todayInTimezone } from "#api/shared/domain/date/utils/timezone";
import type { DomainEvent } from "#api/shared/domain/model/domain-event";

import { TodoToggledEvent } from "../../../shared/domain/todo-toggled.event.js";
import {
  isAllCompletedToday,
  milestoneForCount,
} from "../../domain/todo-completion.domain-service.js";
import type { FriendPort } from "../ports/friend.port.js";
import type { StreakPort } from "../ports/streak.port.js";
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
    const effects = [this.#recordStreak(userId, completed, timezone)];
    if (completed) {
      effects.push(this.#notifyFriendsIfAllDone(userId, timezone), this.#notifyMilestone(userId));
    }
    await Promise.all(effects);
  }

  async #recordStreak(userId: string, completed: boolean, timezone: string): Promise<void> {
    try {
      await this.#dependencies.streakPort.recordTodoToggle(userId, completed, timezone);
    } catch (error) {
      this.#dependencies.logger.error({
        event: TodoLogEvent.STREAK_RECORD_FAILED,
        userId,
        errorType: toErrorType(error),
      });
    }
  }

  async #notifyFriendsIfAllDone(userId: string, timezone: string): Promise<void> {
    try {
      const stats = await this.#dependencies.todoReadRepository.getTodayTodoStats(
        userId,
        todayInTimezone(timezone),
      );
      if (!isAllCompletedToday(stats)) {
        return;
      }
      const [friendIds, userName] = await Promise.all([
        this.#dependencies.friendPort.getMutualFriendIds(userId),
        this.#dependencies.friendPort.getUserDisplayName(userId),
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
        await this.#dependencies.todoReadRepository.countCompletedByUser(userId),
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
