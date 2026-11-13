import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
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
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

/**
 * 완료 토글이 다른 Context(스트릭·친구 완료 알림·마일스톤)에 미치는 효과다. 토글과 같은 트랜잭션 안에서 부른다.
 * 스트릭은 응답 직후 위젯·요약에 바로 보여야 해서 큐로 미루지 않고, 알림은 작업 행이 함께 커밋된다.
 * 실패는 토글과 함께 되돌린다(트랜잭션 안에서 SQL 오류를 삼키면 이후 문장이 모두 실패한다).
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
    const ownerId = UserId.reconstitute(userId);
    // 스트릭과 친구 완료 알림이 같은 오늘 현황을 보므로 한 번만 센다
    const todayStats = await this.#readTodayStats(ownerId, timezone);

    await this.#dependencies.streakPort.recordTodoToggle(ownerId, completed, timezone, todayStats);

    if (completed) {
      await this.#notifyMilestone(ownerId);
      await this.#notifyFriendsIfAllDone(ownerId, timezone, todayStats);
    }
  }

  async #readTodayStats(ownerId: UserId, timezone: string): Promise<TodayCompletionStats> {
    const date = localDateAt(this.#dependencies.clock.now(), timezone);
    const stats = await this.#dependencies.todoReadRepository.getTodayTodoStats(ownerId, date);
    return { date, ...stats };
  }

  async #notifyFriendsIfAllDone(
    ownerId: UserId,
    timezone: string,
    todayStats: TodayCompletionStats,
  ): Promise<void> {
    if (!isAllCompletedToday(todayStats)) {
      return;
    }
    const friendIds = await this.#dependencies.friendPort.getMutualFriendIds(ownerId);
    if (friendIds.length === 0) {
      return;
    }
    await this.#dependencies.todoNotification.enqueueFriendCompleted({
      friendId: ownerId.value,
      friendName: await this.#dependencies.friendPort.getUserDisplayName(ownerId),
      notifyUserIds: friendIds,
      timezone,
    });
    this.#dependencies.logger.log({
      event: TodoLogEvent.FRIEND_COMPLETED_ENQUEUED,
      userId: ownerId.value,
      count: friendIds.length,
    });
  }

  async #notifyMilestone(ownerId: UserId): Promise<void> {
    const milestone = milestoneForCount(
      await this.#dependencies.todoReadRepository.countCompletedByUser(
        ownerId,
        MILESTONE_COMPLETION_COUNT_LIMIT,
      ),
    );
    if (milestone != null) {
      await this.#dependencies.todoNotification.enqueueMilestoneReached({
        userId: ownerId.value,
        milestone,
      });
    }
  }
}
