import {
  DEVICE_TYPES,
  PREMIUM_SOURCE,
  STORE_PERIOD_TYPES,
  SUBSCRIPTION_ENVIRONMENTS,
  SUBSCRIPTION_PLAN_TYPES,
} from "@aido/api/vocabulary";
import { z } from "zod";

import { defineQueue, JOB_POLLING_SECONDS } from "#api/shared/application/ports/job-queue.port";

import {
  NOTICE_END_REASON,
  NOTICE_STORE,
  SIGNUP_METHOD,
  SUBSCRIPTION_NOTICE_EVENT,
} from "../../application/read-models/admin-notice.read-model.js";
import { ADMIN_NOTIFICATION_SEVERITIES } from "../../application/read-models/admin-notification.read-model.js";
import { ADMIN_NOTIFICATION_CHANNELS } from "../../domain/admin-notices.constants.js";

export const AdminNotificationJobName = {
  DISPATCH_SUMMARY: "dispatch-signup-summary",
  SEND: "send-notification",
} as const;

const NotificationChannelSchema = z.enum(ADMIN_NOTIFICATION_CHANNELS);

const AdminNotificationSchema = z.object({
  title: z.string(),
  body: z.string(),
  severity: z.enum(ADMIN_NOTIFICATION_SEVERITIES),
  fields: z
    .array(
      z.object({
        label: z.string(),
        value: z.discriminatedUnion("kind", [
          z.object({ kind: z.literal("text"), text: z.string() }),
          z.object({ kind: z.literal("datetime"), iso: z.string() }),
        ]),
        inline: z.boolean().optional(),
      }),
    )
    .readonly()
    .optional(),
  link: z.string().optional(),
});

/** 표시에만 쓰는 값은 모르는 값이 와도 잡을 버리지 않고 비운 채 보낸다. */
function optionalDisplay<T extends z.ZodType>(schema: T) {
  return schema.optional().catch(undefined);
}

const AdminNoticeUserSchema = z.object({
  userId: z.string(),
  email: z.string(),
  nickname: optionalDisplay(z.string()),
  userTag: optionalDisplay(z.string()),
  joinedAt: optionalDisplay(z.string()),
  signupMethod: optionalDisplay(z.enum(SIGNUP_METHOD)),
});

const SubscriptionNoticeSchema = z.object({
  event: z.enum(SUBSCRIPTION_NOTICE_EVENT),
  environment: optionalDisplay(z.enum(SUBSCRIPTION_ENVIRONMENTS)),
  store: optionalDisplay(z.enum(NOTICE_STORE)),
  productId: optionalDisplay(z.string()),
  planType: optionalDisplay(z.enum(SUBSCRIPTION_PLAN_TYPES)),
  newProductId: optionalDisplay(z.string()),
  newPlanType: optionalDisplay(z.enum(SUBSCRIPTION_PLAN_TYPES)),
  periodKind: optionalDisplay(z.enum(STORE_PERIOD_TYPES)),
  price: z.object({
    amount: optionalDisplay(z.number()),
    currency: optionalDisplay(z.string()),
    usd: optionalDisplay(z.number()),
  }),
  purchasedAt: optionalDisplay(z.string()),
  expiresAt: optionalDisplay(z.string()),
  gracePeriodEndsAt: optionalDisplay(z.string()),
  endReason: optionalDisplay(z.enum(NOTICE_END_REASON)),
  countryCode: optionalDisplay(z.string()),
  isFirstPurchase: optionalDisplay(z.boolean()),
  premium: optionalDisplay(
    z.object({
      source: z.enum(PREMIUM_SOURCE).nullable(),
      periodEndsAt: z.string().optional(),
      bankedDays: z.number(),
      isTrial: z.boolean(),
    }),
  ),
  transfer: optionalDisplay(
    z.object({ from: z.array(z.string()).readonly(), to: z.array(z.string()).readonly() }),
  ),
  storeSubscriptionId: optionalDisplay(z.string()),
  appVersion: optionalDisplay(z.string()),
  deviceModel: optionalDisplay(z.string()),
  customerUrl: optionalDisplay(z.string()),
});

const SignupNoticeSchema = z.object({
  devicePlatform: optionalDisplay(z.enum(DEVICE_TYPES)),
  deviceModel: optionalDisplay(z.string()),
  osVersion: optionalDisplay(z.string()),
  appVersion: optionalDisplay(z.string()),
  appBuild: optionalDisplay(z.string()),
  locale: optionalDisplay(z.string()),
  timezone: optionalDisplay(z.string()),
});

const AdminNoticeSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("message"), message: AdminNotificationSchema }),
  z.object({
    type: z.literal("user_registered"),
    user: AdminNoticeUserSchema,
    signup: SignupNoticeSchema,
  }),
  z.object({
    type: z.literal("subscription_event"),
    user: AdminNoticeUserSchema,
    subscription: SubscriptionNoticeSchema,
  }),
]);

const adminNotificationJobSchema = z.discriminatedUnion("name", [
  z.object({
    name: z.literal(AdminNotificationJobName.DISPATCH_SUMMARY),
    data: z.object({}),
  }),
  z.object({
    name: z.literal(AdminNotificationJobName.SEND),
    data: z.object({ channel: NotificationChannelSchema, notice: AdminNoticeSchema }),
  }),
]);

export type AdminNotificationJob = z.output<typeof adminNotificationJobSchema>;

const DAY_SECONDS = 24 * 60 * 60;

// 일시 실패(429·5xx·연결 실패)만 2번 다시 시도한다. 거절은 다시 보내지 않고 운영 경보를 올린다
export const ADMIN_NOTIFICATION_QUEUE = defineQueue({
  name: "admin-notification.v1",
  payloadSchema: adminNotificationJobSchema,
  retry: {
    retryLimit: 2,
    retryDelaySeconds: 5,
    retryBackoff: true,
    expireInSeconds: 5 * 60,
    retentionSeconds: DAY_SECONDS,
    deleteAfterSeconds: DAY_SECONDS,
  },
  worker: { localConcurrency: 3, pollingIntervalSeconds: JOB_POLLING_SECONDS.SCHEDULED },
  // 일일 가입 요약은 자정 직전 가입 transaction의 지연을 고려해 KST 00:10에 돌고, 집계는 전일 KST 범위다.
  // 하루 한 번이고 요약 작업 key가 날짜라 놓친 실행은 한 번만 따라잡아도 중복되지 않는다
  schedules: [
    {
      key: "daily-signup-summary-scheduler",
      cron: "10 0 * * *",
      timezone: "Asia/Seoul",
      missed: "once",
      payload: { name: AdminNotificationJobName.DISPATCH_SUMMARY, data: {} },
    },
  ],
});
