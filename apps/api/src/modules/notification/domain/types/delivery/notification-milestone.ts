export const NOTIFICATION_MILESTONES = [
  "FIRST_COMPLETE",
  "COUNT_10",
  "COUNT_50",
  "COUNT_100",
  "STREAK_3",
  "FIRST_FRIEND",
] as const;

export type NotificationMilestone = (typeof NOTIFICATION_MILESTONES)[number];
