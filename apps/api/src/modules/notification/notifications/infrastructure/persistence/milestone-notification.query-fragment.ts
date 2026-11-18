import { type SQL, sql } from "drizzle-orm";

import { notification } from "#api/platform/database/schema/index";

import {
  MILESTONE_NOTIFICATION_TYPE,
  type NotificationMilestone,
} from "../../../shared/domain/notification-milestone.constants.js";

// 한 번뿐인 마일스톤 알림 행이다. 다시 보내지 않는 근거(hasMilestoneNotification)라 보관 기간 정리도 남긴다
export function milestoneNotificationCondition(milestone: NotificationMilestone | null): SQL {
  const milestoneValue = sql`${notification.metadata} ->> 'milestone'`;
  const milestoneMatch =
    milestone == null ? sql`${milestoneValue} IS NOT NULL` : sql`${milestoneValue} = ${milestone}`;
  return sql`(${notification.type} = ${MILESTONE_NOTIFICATION_TYPE} AND ${milestoneMatch})`;
}
