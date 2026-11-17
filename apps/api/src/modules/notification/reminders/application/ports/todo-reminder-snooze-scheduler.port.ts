import type { TodoId } from "#api/modules/planning/todos/planning-todos-queries.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { NotificationId } from "../../../shared/domain/notification-id.vo.js";

export interface SnoozedReminderSchedule {
  readonly todoId: TodoId;
  readonly userId: UserId;
  /** 다시 알림 버튼을 누른 알림. 같은 알림의 두 번째 요청을 한 번으로 묶는다 */
  readonly notificationId: NotificationId;
  readonly remindAt: Temporal.Instant;
}

// 다시 알림 한 번을 리마인더 큐에 예약한다
export abstract class TodoReminderSnoozeSchedulerPort {
  /** 새로 예약했으면 true, 같은 알림으로 이미 예약했으면 false다 */
  abstract scheduleSnooze(schedule: SnoozedReminderSchedule): Promise<boolean>;
}
