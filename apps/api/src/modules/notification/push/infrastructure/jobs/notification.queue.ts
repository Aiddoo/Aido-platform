import { z } from "zod";

import {
  defineQueue,
  JOB_POLLING_SECONDS,
  type JobRetryPolicy,
} from "#api/shared/application/ports/job-queue.port";

import { NOTIFICATION_MILESTONES } from "../../domain/notification-milestone.constants.js";

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

const NOTIFICATION_RETRY = {
  retryLimit: 2,
  retryDelaySeconds: 1,
  retryBackoff: true,
  expireInSeconds: 5 * 60,
  retentionSeconds: 7 * DAY_SECONDS,
  deleteAfterSeconds: DAY_SECONDS,
} as const satisfies JobRetryPolicy;

// 재시도를 다 쓴 이벤트는 사람이 원인을 확인할 수 있게 더 오래 보관한다
const NOTIFICATION_DEAD_LETTER_RETRY = {
  ...NOTIFICATION_RETRY,
  retryLimit: 0,
  retentionSeconds: 14 * DAY_SECONDS,
  deleteAfterSeconds: 14 * DAY_SECONDS,
} as const satisfies JobRetryPolicy;

// Expo는 발송 약 15분 뒤 receipt 확인을 권하고 조회 대상도 수락 15분 뒤부터라, 매분 돌면 할 일 없이 작업 행만 쌓인다.
// 한 실행이 45초 예산 안에서 남은 ticket을 모두 이어 처리하므로 놓친 실행은 다음 실행이 받는다
const PUSH_RECEIPT_SCHEDULE = {
  key: "push-receipts-scheduler",
  cron: "*/5 * * * *",
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
type NotificationJobNameValue = NotificationRuntimeJob["name"];
type NotificationJobOf<Name extends NotificationJobNameValue> = Extract<
  NotificationRuntimeJob,
  { name: Name }
>;
type NotificationJobData<Name extends NotificationJobNameValue> = NotificationJobOf<Name>["data"];

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

// 늦은 소셜 알림은 의미가 없어 다시 보내지 않고 기록만 한다
export const NOTIFICATION_DEAD_LETTER_QUEUE = defineQueue({
  name: "notification-dead-letter.v1",
  payloadSchema: NotificationRuntimeJobSchema,
  retry: NOTIFICATION_DEAD_LETTER_RETRY,
  worker: { localConcurrency: 1, pollingIntervalSeconds: JOB_POLLING_SECONDS.BACKGROUND },
});

// 결제 문제 알림은 다시 실행하면 한 번 더 보내므로 묶음으로 가져와도 작업마다 따로 끝낸다
export const NOTIFICATION_QUEUE = defineQueue({
  name: "notification.v1",
  payloadSchema: NotificationRuntimeJobSchema,
  retry: NOTIFICATION_RETRY,
  deadLetter: {
    queue: NOTIFICATION_DEAD_LETTER_QUEUE.name,
    jobPolicy: NOTIFICATION_DEAD_LETTER_RETRY,
  },
  worker: {
    localConcurrency: 3,
    pollingIntervalSeconds: JOB_POLLING_SECONDS.INTERACTIVE,
    batchSize: 5,
    burstWhenBatchFull: true,
    isolateJobFailures: true,
  },
});

// 예약 receipt 작업은 DLQ 없이 다음 실행이 이어 받는다. 이벤트 정의와 이름·재시도만 같게 둔다
export const PUSH_RECEIPTS_SCHEDULE_QUEUE = defineQueue({
  name: NOTIFICATION_QUEUE.name,
  payloadSchema: NotificationRuntimeJobSchema,
  retry: NOTIFICATION_RETRY,
  worker: NOTIFICATION_QUEUE.worker,
  schedules: [
    {
      key: PUSH_RECEIPT_SCHEDULE.key,
      cron: PUSH_RECEIPT_SCHEDULE.cron,
      timezone: "UTC",
      missed: "skip",
      payload: { name: NotificationJobName.PUSH_RECEIPTS, data: {} },
    },
  ],
});
