import { z } from "zod";

import { JOB_POLLING_SECONDS } from "#api/shared/application/ports/index";

import { NOTIFICATION_MILESTONES } from "../../../domain/types/delivery/notification-milestone.js";

export const NOTIFICATION_QUEUE = "notification.v1";
export const NOTIFICATION_DEAD_LETTER_QUEUE = "notification-dead-letter.v1";

export const NotificationJobName = {
  FOLLOW_NEW: "follow-new",
  FOLLOW_MUTUAL: "follow-mutual",
  NUDGE_SENT: "nudge-sent",
  CHEER_SENT: "cheer-sent",
  BILLING_ISSUE: "billing-issue",
  FRIEND_COMPLETED: "friend-completed",
  MILESTONE_REACHED: "milestone-reached",
  PUSH_RECEIPTS: "push-receipts",
} as const;

const DAY_SECONDS = 24 * 60 * 60;

export const NOTIFICATION_JOB_POLICY = {
  retryLimit: 2,
  retryDelaySeconds: 1,
  retryBackoff: true,
  expireInSeconds: 5 * 60,
  retentionSeconds: 7 * DAY_SECONDS,
  deleteAfterSeconds: DAY_SECONDS,
} as const;

/** 재시도를 다 쓴 이벤트는 사람이 원인을 확인할 수 있게 더 오래 보관한다. */
export const NOTIFICATION_DEAD_LETTER_JOB_POLICY = {
  ...NOTIFICATION_JOB_POLICY,
  retryLimit: 0,
  retentionSeconds: 14 * DAY_SECONDS,
  deleteAfterSeconds: 14 * DAY_SECONDS,
} as const;

export const NOTIFICATION_EVENT_JOB_POLICY = {
  ...NOTIFICATION_JOB_POLICY,
  deadLetter: {
    queue: NOTIFICATION_DEAD_LETTER_QUEUE,
    jobPolicy: NOTIFICATION_DEAD_LETTER_JOB_POLICY,
  },
} as const;

/** 호출자는 커밋 뒤 결과를 기다리지 않으므로 일시적인 DB 오류만 짧게 다시 시도한다. */
export const NOTIFICATION_ENQUEUE_RETRY = {
  retries: 3,
  delayMs: 200,
} as const;

export const NOTIFICATION_WORKER_POLICY = {
  teamSize: 5,
  pollingIntervalSeconds: JOB_POLLING_SECONDS.INTERACTIVE,
} as const;

export const NOTIFICATION_DEAD_LETTER_WORKER_POLICY = {
  teamSize: 1,
  pollingIntervalSeconds: JOB_POLLING_SECONDS.BACKGROUND,
  queuePolicy: NOTIFICATION_DEAD_LETTER_JOB_POLICY,
} as const;

/** receipt 정리는 실행 예산(45초) 안에서 끝나므로 1분마다 돌려도 겹치지 않는다. */
export const PUSH_RECEIPT_SCHEDULE = {
  key: "push-receipts-scheduler",
  cron: "* * * * *",
} as const;

const FollowNewJobDataSchema = z.object({
  followerId: z.string().min(1),
  followingId: z.string().min(1),
  followerName: z.string(),
});

const FollowMutualJobDataSchema = z.object({
  userId: z.string().min(1),
  friendId: z.string().min(1),
  friendName: z.string(),
});

const NudgeSentJobDataSchema = z.object({
  nudgeId: z.number().int(),
  senderId: z.string().min(1),
  receiverId: z.string().min(1),
  senderName: z.string(),
  todoId: z.number().int().optional(),
  todoTitle: z.string().optional(),
  message: z.string().optional(),
});

const CheerSentJobDataSchema = z.object({
  cheerId: z.number().int(),
  senderId: z.string().min(1),
  receiverId: z.string().min(1),
  senderName: z.string(),
  message: z.string().optional(),
});

const BillingIssueJobDataSchema = z.object({ userId: z.string().min(1) });

const FriendCompletedJobDataSchema = z.object({
  friendId: z.string().min(1),
  friendName: z.string(),
  notifyUserIds: z.array(z.string().min(1)),
  timezone: z.string().min(1),
});

const MilestoneReachedJobDataSchema = z.object({
  userId: z.string().min(1),
  milestone: z.enum(NOTIFICATION_MILESTONES),
});

export const NotificationRuntimeJobSchema = z.discriminatedUnion("name", [
  z.object({
    name: z.literal(NotificationJobName.FOLLOW_NEW),
    data: FollowNewJobDataSchema,
  }),
  z.object({
    name: z.literal(NotificationJobName.FOLLOW_MUTUAL),
    data: FollowMutualJobDataSchema,
  }),
  z.object({
    name: z.literal(NotificationJobName.NUDGE_SENT),
    data: NudgeSentJobDataSchema,
  }),
  z.object({
    name: z.literal(NotificationJobName.CHEER_SENT),
    data: CheerSentJobDataSchema,
  }),
  z.object({
    name: z.literal(NotificationJobName.BILLING_ISSUE),
    data: BillingIssueJobDataSchema,
  }),
  z.object({
    name: z.literal(NotificationJobName.FRIEND_COMPLETED),
    data: FriendCompletedJobDataSchema,
  }),
  z.object({
    name: z.literal(NotificationJobName.MILESTONE_REACHED),
    data: MilestoneReachedJobDataSchema,
  }),
  z.object({
    name: z.literal(NotificationJobName.PUSH_RECEIPTS),
    data: z.object({}),
  }),
]);

export type NotificationRuntimeJob = z.output<typeof NotificationRuntimeJobSchema>;
export type NotificationJobNameValue = NotificationRuntimeJob["name"];
export type NotificationJobOf<Name extends NotificationJobNameValue> = Extract<
  NotificationRuntimeJob,
  { name: Name }
>;
export type NotificationJobData<Name extends NotificationJobNameValue> =
  NotificationJobOf<Name>["data"];

export type FollowNewJobData = NotificationJobData<typeof NotificationJobName.FOLLOW_NEW>;
export type FollowMutualJobData = NotificationJobData<typeof NotificationJobName.FOLLOW_MUTUAL>;
export type NudgeSentJobData = NotificationJobData<typeof NotificationJobName.NUDGE_SENT>;
export type CheerSentJobData = NotificationJobData<typeof NotificationJobName.CHEER_SENT>;
export type BillingIssueJobData = NotificationJobData<typeof NotificationJobName.BILLING_ISSUE>;
export type FriendCompletedJobData = NotificationJobData<
  typeof NotificationJobName.FRIEND_COMPLETED
>;
export type MilestoneReachedJobData = NotificationJobData<
  typeof NotificationJobName.MILESTONE_REACHED
>;
