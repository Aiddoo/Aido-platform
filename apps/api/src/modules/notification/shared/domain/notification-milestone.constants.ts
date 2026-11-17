import type { NotificationType } from "./notification-type.constants.js";

export const NOTIFICATION_MILESTONES = [
  "FIRST_COMPLETE",
  "COUNT_10",
  "COUNT_50",
  "COUNT_100",
  "STREAK_3",
  "FIRST_FRIEND",
] as const;

export type NotificationMilestone = (typeof NOTIFICATION_MILESTONES)[number];

// 마일스톤은 처음부터 이 종류에 metadata.milestone을 실어 보냈다
export const MILESTONE_NOTIFICATION_TYPE = "WEEKLY_ACHIEVEMENT" satisfies NotificationType;
