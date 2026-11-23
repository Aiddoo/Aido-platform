import type { TodoId } from "#api/modules/planning/todos/planning-todos-queries.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { NotificationId } from "../../../notifications/domain/notification-id.vo.js";

export interface SnoozedReminderSchedule {
  readonly todoId: TodoId;
  readonly userId: UserId;
  /** 다시 알림 버튼을 누른 알림. 같은 알림의 두 번째 요청을 한 번으로 묶는다 */
  readonly notificationId: NotificationId;
  readonly remindAt: Temporal.Instant;
}

export interface SnoozedReminderBooking {
  /** 다시 알림이 울릴 시각. 같은 알림으로 이미 예약했으면 그 예약의 시각이다 */
  readonly remindAt: Temporal.Instant;
  readonly isNew: boolean;
}

// 다시 알림 한 번을 리마인더 큐에 예약한다
export abstract class TodoReminderSnoozeSchedulerPort {
  abstract scheduleSnooze(schedule: SnoozedReminderSchedule): Promise<SnoozedReminderBooking>;
}
