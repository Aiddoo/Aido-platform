import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";

import { toErrorType } from "#api/shared/application/utils/error-message.util";
import { todayInTimezone } from "#api/shared/domain/date/utils/timezone";

import { TODO_EVENTS } from "../../../shared/domain/todo-event-names.constants.js";
import type { TodoToggledEvent } from "../../../shared/domain/todo-toggled.event.js";
import { FriendPort } from "../../application/ports/friend.port.js";
import { StreakPort } from "../../application/ports/streak.port.js";
import { TodoNotificationPort } from "../../application/ports/todo-notification.port.js";
import { TodoReadRepositoryPort } from "../../application/ports/todo-read.repository.port.js";
import { TodoLogEvent } from "../../application/todos.log-events.js";
import {
  isAllCompletedToday,
  milestoneForCount,
} from "../../domain/todo-completion.domain-service.js";

/**
 * 완료 토글 뒤 다른 Context(스트릭·친구 알림·마일스톤)에 미치는 효과다. 리마인더 취소는 UseCase가
 * 같은 트랜잭션에서 하므로 여기 없다. 이 반응들은 소유 Context가 내구성 있는 구독으로 옮길 때까지
 * 커밋 뒤 in-process로 남고, 실패는 기록만 하고 할 일 흐름에 전파하지 않는다.
 */
@Injectable()
export class TodoCompletionEffectsEventHandler {
  readonly #logger = new Logger(TodoCompletionEffectsEventHandler.name);
  readonly #todoReadRepository: Pick<
    TodoReadRepositoryPort,
    "getTodayTodoStats" | "countCompletedByUser"
  >;
  readonly #friendPort: FriendPort;
  readonly #todoNotification: TodoNotificationPort;
  readonly #streakPort: Pick<StreakPort, "recordTodoToggle">;

  constructor(
    todoReadRepository: TodoReadRepositoryPort,
    friendPort: FriendPort,
    todoNotification: TodoNotificationPort,
    streakPort: StreakPort,
  ) {
    this.#todoReadRepository = todoReadRepository;
    this.#friendPort = friendPort;
    this.#todoNotification = todoNotification;
    this.#streakPort = streakPort;
  }

  @OnEvent(TODO_EVENTS.TOGGLED, { suppressErrors: false })
  async handle(event: TodoToggledEvent): Promise<void> {
    const { userId, completed, timezone } = event;
    const effects = [this.#recordStreak(userId, completed, timezone)];
    if (completed) {
      effects.push(this.#notifyFriendsIfAllDone(userId, timezone), this.#notifyMilestone(userId));
    }
    await Promise.all(effects);
  }

  async #recordStreak(userId: string, completed: boolean, timezone: string): Promise<void> {
    try {
      await this.#streakPort.recordTodoToggle(userId, completed, timezone);
    } catch (error) {
      this.#logger.error({
        event: TodoLogEvent.STREAK_RECORD_FAILED,
        userId,
        errorType: toErrorType(error),
      });
    }
  }

  async #notifyFriendsIfAllDone(userId: string, timezone: string): Promise<void> {
    try {
      const stats = await this.#todoReadRepository.getTodayTodoStats(
        userId,
        todayInTimezone(timezone),
      );
      if (!isAllCompletedToday(stats)) {
        return;
      }
      const [friendIds, userName] = await Promise.all([
        this.#friendPort.getMutualFriendIds(userId),
        this.#friendPort.getUserDisplayName(userId),
      ]);
      if (friendIds.length === 0) {
        return;
      }
      this.#todoNotification.enqueueFriendCompleted({
        friendId: userId,
        friendName: userName,
        notifyUserIds: friendIds,
        timezone,
      });
      this.#logger.log({
        event: TodoLogEvent.FRIEND_COMPLETED_ENQUEUED,
        userId,
        count: friendIds.length,
      });
    } catch (error) {
      this.#logger.error({
        event: TodoLogEvent.FRIEND_COMPLETED_FAILED,
        userId,
        errorType: toErrorType(error),
      });
    }
  }

  async #notifyMilestone(userId: string): Promise<void> {
    try {
      const milestone = milestoneForCount(
        await this.#todoReadRepository.countCompletedByUser(userId),
      );
      if (milestone == null) {
        return;
      }
      this.#todoNotification.enqueueMilestoneReached({ userId, milestone });
    } catch (error) {
      this.#logger.error({
        event: TodoLogEvent.MILESTONE_CHECK_FAILED,
        userId,
        errorType: toErrorType(error),
      });
    }
  }
}
