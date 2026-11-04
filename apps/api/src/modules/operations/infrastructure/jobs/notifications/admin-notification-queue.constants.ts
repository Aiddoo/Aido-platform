/**
 * Admin Notification 큐 상수 및 잡 데이터 타입 정의
 */

import { z } from "zod";

import { JOB_POLLING_SECONDS } from "#api/shared/application/ports/index";

import {
  ADMIN_NOTIFICATION_SEVERITIES,
  type AdminNotification,
} from "../../../application/read-models/notifications/admin-notification.read-model.js";

export const ADMIN_NOTIFICATION_QUEUE = "admin-notification.v1";

export const AdminNotificationJobName = {
  DISPATCH_SUMMARY: "dispatch-signup-summary",
  SEND: "send-notification",
} as const;

/** 기존 재시도·보관 계약. JobRuntime이 각 backend 옵션으로 변환한다. */
export const ADMIN_NOTIFICATION_JOB_POLICY = {
  retryLimit: 2,
  retryDelaySeconds: 5,
  retryBackoff: true,
  expireInSeconds: 5 * 60,
  retentionSeconds: 24 * 60 * 60,
  deleteAfterSeconds: 24 * 60 * 60,
} as const;

export const ADMIN_NOTIFICATION_WORKER_POLICY = {
  teamSize: 3,
  pollingIntervalSeconds: JOB_POLLING_SECONDS.SCHEDULED,
} as const;

export const DAILY_SIGNUP_SUMMARY_SCHEDULE = {
  key: "daily-signup-summary-scheduler",
  cron: "10 0 * * *",
  timezone: "Asia/Seoul",
  jobPolicy: {
    retryLimit: 2,
    retryDelaySeconds: 1,
    retryBackoff: true,
    expireInSeconds: 5 * 60,
    retentionSeconds: 24 * 60 * 60,
    deleteAfterSeconds: 24 * 60 * 60,
  },
} as const;

/** send-notification 잡 데이터 */
export interface AdminNotificationSendData {
  channel: "admin" | "payment";
  notification: AdminNotification;
}

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
    .optional(),
  link: z.string().optional(),
});

/**
 * 채널 중립 알림 이전(1.14) 형식. 배포 중 큐에 남은 잡(보관 24시간)을 한 릴리스 동안 받아들이고,
 * 색은 의미를 알 수 없어 info로 둔다. 다음 릴리스에서 지운다.
 */
const LegacyAdminNotificationSchema = z
  .object({
    title: z.string(),
    body: z.string(),
    fields: z
      .array(z.object({ name: z.string(), value: z.string(), inline: z.boolean().optional() }))
      .optional(),
    color: z.number().optional(),
  })
  .transform(({ title, body, fields }): AdminNotification => ({
    title,
    body,
    severity: "info",
    fields: (fields ?? []).map(({ name, value, inline }) => ({
      label: name,
      value: { kind: "text", text: value },
      ...(inline == null ? {} : { inline }),
    })),
  }));

export const AdminNotificationRuntimeJobSchema = z.discriminatedUnion("name", [
  z.object({
    name: z.literal(AdminNotificationJobName.DISPATCH_SUMMARY),
    data: z.object({}),
  }),
  z.object({
    name: z.literal(AdminNotificationJobName.SEND),
    data: z.object({
      channel: z.enum(["admin", "payment"]),
      notification: z.union([AdminNotificationSchema, LegacyAdminNotificationSchema]),
    }),
  }),
]);

export interface AdminNotificationJobMap {
  [AdminNotificationJobName.DISPATCH_SUMMARY]: Record<string, never>;
  [AdminNotificationJobName.SEND]: AdminNotificationSendData;
}

export type AdminNotificationJobData = AdminNotificationJobMap[keyof AdminNotificationJobMap];

export type AdminNotificationRuntimeJob = z.infer<typeof AdminNotificationRuntimeJobSchema>;
