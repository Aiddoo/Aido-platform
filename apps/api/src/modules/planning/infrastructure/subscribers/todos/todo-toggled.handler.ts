import { Inject, Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";

import { toErrorType } from "#api/shared/application/utils/error-message.util";
import { todayInTimezone } from "#api/shared/domain/date/utils/timezone";

import { PlanningTodoLogEvent } from "../../../application/observability/todos/planning-todo-log.events.js";
import { FRIEND_PORT, type FriendPort } from "../../../application/ports/todos/friend.port.js";
import { STREAK_PORT, type StreakPort } from "../../../application/ports/todos/streak.port.js";
import {
  TODO_NOTIFICATION,
  type TodoNotificationPort,
} from "../../../application/ports/todos/todo-notification.port.js";
import {
  TODO_READ_REPOSITORY,
  type TodoReadRepositoryPort,
} from "../../../application/ports/todos/todo-read.repository.port.js";
import {
  TODO_REMINDER,
  type TodoReminderPort,
} from "../../../application/ports/todos/todo-reminder.port.js";
import { TODO_EVENTS } from "../../../domain/events/todos/todo-event-names.js";
import { TodoToggledEvent } from "../../../domain/events/todos/todo-toggled.event.js";
import {
  isAllCompletedToday,
  milestoneForCount,
} from "../../../domain/policies/todos/completion.policy.js";

/**
 * Todo 완료 토글 이벤트 핸들러
 *
 * - 스트릭 갱신은 양방향(완료/미완료)으로 수행합니다.
 * - 완료로 전환된 경우에만 리마인더 취소 + 친구 완료 알림 + 마일스톤 체크를 수행합니다.
 *
 * 핸들러 본문이 자기 부수효과를 끝까지 await로 소유합니다 — 떠다니는
 * 프라미스를 남기면 완료 시점을 아무도 알 수 없어 테스트 격리(TRUNCATE)와
 * 경합하고, 프로세스 종료 시 유실될 수 있습니다.
 * 리마인더 취소 실패는 퍼블리셔 경계까지 전파되고, 퍼블리셔가 문맥을 기록한
 * 뒤 post-commit 요청 성공을 유지합니다.
 * 크로스모듈 의존은 포트를 통해서만, 판단 규칙은 도메인 정책(completion-policy)을 통해 접근합니다.
 */
@Injectable()
export class TodoToggledHandler {
  readonly #logger = new Logger(TodoToggledHandler.name);

  constructor(
    @Inject(TODO_READ_REPOSITORY)
    private readonly todoReadRepository: TodoReadRepositoryPort,
    @Inject(FRIEND_PORT)
    private readonly friendPort: FriendPort,
    @Inject(TODO_NOTIFICATION)
    private readonly todoNotification: TodoNotificationPort,
    @Inject(STREAK_PORT)
    private readonly streakPort: StreakPort,
    @Inject(TODO_REMINDER)
    private readonly todoReminder: TodoReminderPort,
  ) {}

  @OnEvent(TODO_EVENTS.TOGGLED, { suppressErrors: false })
  async handle(event: TodoToggledEvent): Promise<void> {
    const { todoId, userId, completed, timezone } = event;

    const sideEffects: Promise<void>[] = [];
    let cancellation: Promise<void> | undefined;
    if (completed) {
      cancellation = this.todoReminder.cancelReminders([todoId]);
      sideEffects.push(this.#checkAndEnqueueFriendCompleted(userId, timezone));
      sideEffects.push(this.#checkAndEnqueueMilestone(userId));
    }

    // 스트릭은 양방향 갱신
    sideEffects.push(this.#recordStreakSafely(userId, completed, timezone));

    const outcomes = await Promise.allSettled(
      cancellation ? [cancellation, ...sideEffects] : sideEffects,
    );
    const cancellationOutcome = cancellation ? outcomes[0] : undefined;
    if (cancellationOutcome?.status === "rejected") {
      throw cancellationOutcome.reason;
    }
  }

  async #recordStreakSafely(userId: string, completed: boolean, timezone: string): Promise<void> {
    try {
      await this.streakPort.recordTodoToggle(userId, completed, timezone);
    } catch (error) {
      this.#logger.error({
        event: PlanningTodoLogEvent.STREAK_RECORD_FAILED,
        userId,
        errorType: toErrorType(error),
      });
    }
  }

  /**
   * 오늘 할일 전체 완료 시 친구들에게 알림 큐에 등록
   */
  async #checkAndEnqueueFriendCompleted(userId: string, timezone: string): Promise<void> {
    try {
      const today = todayInTimezone(timezone);
      const stats = await this.todoReadRepository.getTodayTodoStats(userId, today);

      if (isAllCompletedToday(stats)) {
        const [friendIds, userName] = await Promise.all([
          this.friendPort.getMutualFriendIds(userId),
          this.friendPort.getUserDisplayName(userId),
        ]);

        if (friendIds.length > 0) {
          this.todoNotification.enqueueFriendCompleted({
            friendId: userId,
            friendName: userName,
            notifyUserIds: friendIds,
            timezone,
          });

          this.#logger.log({
            event: PlanningTodoLogEvent.FRIEND_COMPLETED_ENQUEUED,
            userId,
            count: friendIds.length,
          });
        }
      }
    } catch (error) {
      this.#logger.error({
        event: PlanningTodoLogEvent.FRIEND_COMPLETED_FAILED,
        userId,
        errorType: toErrorType(error),
      });
    }
  }

  async #checkAndEnqueueMilestone(userId: string): Promise<void> {
    try {
      const count = await this.todoReadRepository.countCompletedByUser(userId);
      const milestone = milestoneForCount(count);
      if (!milestone) {
        return;
      }
      this.todoNotification.enqueueMilestoneReached({
        userId,
        milestone,
      });
    } catch (error) {
      this.#logger.error({
        event: PlanningTodoLogEvent.MILESTONE_CHECK_FAILED,
        userId,
        errorType: toErrorType(error),
      });
    }
  }
}
