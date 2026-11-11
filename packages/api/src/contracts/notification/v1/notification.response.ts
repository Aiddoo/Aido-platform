import { z } from "zod";

import { datetimeSchema, nullableDatetimeSchema } from "../../../common/datetime.js";
import { PUSH_DEVICE_PLATFORM } from "../../../vocabulary/notification.constants.js";
import { notificationTypeSchema } from "./notification.common.js";
import { notificationBodySchema, notificationTitleSchema } from "./notification.content.js";
import { notificationNavigationSchema } from "./notification.navigation.js";
import { notificationActionSchema, notificationContextSchema } from "./notification.payload.js";
import { pushPermissionSchema } from "./notification.request.js";

export const notificationMetadataSchema = z.record(z.string(), z.unknown()).nullable();

export type NotificationMetadata = z.infer<typeof notificationMetadataSchema>;

export const notificationSchema = z
  .object({
    id: z.number().int().positive().describe("알림 ID (양의 정수)"),
    userId: z.string().describe("사용자 ID"),
    type: notificationTypeSchema
      .exclude([
        "NUDGE_REPLIED",
        "NUDGE_THANKED",
        "INVITE_JOINED",
        "INVITE_REWARDED",
        "PREMIUM_GRANT_ENDING",
        "INVITE_PROGRESS",
        "INVITE_QUALIFY_REMINDER",
      ])
      .describe(
        "알림 타입 (FOLLOW_NEW | FOLLOW_ACCEPTED | NUDGE_RECEIVED | CHEER_RECEIVED 등). 이 enum은 배포된 구버전 앱의 계약입니다. X-App-Version이 1.11.0 이상인 앱은 NUDGE_REPLIED·NUDGE_THANKED를, 1.13.0 이상인 앱은 INVITE_JOINED·INVITE_REWARDED·INVITE_PROGRESS·INVITE_QUALIFY_REMINDER·PREMIUM_GRANT_ENDING도 받습니다. 그보다 낮은 앱의 알림 목록과 푸시에서는 이 타입을 뺍니다.",
      ),
    title: notificationTitleSchema,
    body: notificationBodySchema,
    isRead: z.boolean().describe("읽음 여부"),
    metadata: notificationMetadataSchema.describe(
      "추가 메타데이터 (미설정 시 null). 이동 재료(commentId·threadRootId·activityKind, 할 일 알림의 todoOwnerId·todoDate)를 함께 싣는다",
    ),
    context: notificationContextSchema.optional(),
    action: notificationActionSchema.optional(),
    createdAt: datetimeSchema.describe("생성 시각 (ISO 8601 UTC, 예: 2026-01-17T10:00:00.000Z)"),
    readAt: nullableDatetimeSchema.describe(
      "읽은 시각 (ISO 8601 UTC, 예: 2026-01-17T10:30:00.000Z, 미읽음 시 null)",
    ),
  })
  .meta({
    example: {
      id: 1,
      userId: "clz7x5p8k0001qz0z8z8z8z8z",
      type: "NUDGE_RECEIVED",
      title: "존이 콕 건드렸어",
      body: "할 일 하나가 살짝 흔들렸어 🐾",
      isRead: false,
      metadata: { senderId: "clz7x5p8k0005qz0z8z8z8z8z" },
      createdAt: "2026-01-17T10:00:00.000Z",
      readAt: null,
    },
  });

export type Notification = z.infer<typeof notificationSchema>;

export const notificationListResponseSchema = z
  .object({
    notifications: z.array(notificationSchema).describe("알림 목록"),
    unreadCount: z.number().int().nonnegative().describe("읽지 않은 알림 수 (음이 아닌 정수)"),
    hasMore: z.boolean().describe("다음 페이지 존재 여부"),
    nextCursor: z
      .number()
      .int()
      .positive()
      .nullable()
      .describe("다음 커서 (양의 정수, 마지막 페이지는 null)"),
  })
  .meta({
    example: {
      notifications: [
        {
          id: 1,
          userId: "clz7x5p8k0001qz0z8z8z8z8z",
          type: "NUDGE_RECEIVED",
          title: "존이 콕 건드렸어",
          body: "할 일 하나가 살짝 흔들렸어 🐾",
          isRead: false,
          metadata: { senderId: "clz7x5p8k0005qz0z8z8z8z8z" },
          createdAt: "2026-01-17T10:00:00.000Z",
          readAt: null,
        },
      ],
      unreadCount: 3,
      hasMore: true,
      nextCursor: 2,
    },
  });

export type NotificationListResponse = z.infer<typeof notificationListResponseSchema>;

export const notificationInboxItemSchema = notificationSchema.extend({
  type: notificationTypeSchema,
  // 모양이 맞지 않으면 navigation만 버려 type·action으로 이동하던 기존 경로를 잃지 않는다
  navigation: notificationNavigationSchema
    .optional()
    .catch(undefined)
    .describe("푸시 data의 navigation과 같은 목적지. 계산할 수 없으면 싣지 않는다"),
});
export type NotificationInboxItem = z.infer<typeof notificationInboxItemSchema>;

export const notificationInboxResponseSchema = notificationListResponseSchema.extend({
  notifications: z.array(notificationInboxItemSchema).describe("알림 목록"),
});
export type NotificationInboxResponse = z.infer<typeof notificationInboxResponseSchema>;

export const unreadCountResponseSchema = z
  .object({
    unreadCount: z.number().int().nonnegative().describe("읽지 않은 알림 수 (음이 아닌 정수)"),
  })
  .meta({
    example: {
      unreadCount: 5,
    },
  });

export type UnreadCountResponse = z.infer<typeof unreadCountResponseSchema>;

export const registerTokenResponseSchema = z
  .object({
    message: z.string().describe("응답 메시지"),
    registered: z.boolean().describe("토큰 등록 성공 여부"),
  })
  .meta({
    example: {
      message: "푸시 토큰이 등록되었습니다.",
      registered: true,
    },
  });

export type RegisterTokenResponse = z.infer<typeof registerTokenResponseSchema>;

export const unregisterPushDeviceByTokenResponseSchema = z.object({
  unregistered: z.literal(true).describe("항상 true. 일치하는 등록이 있었는지는 알려 주지 않는다"),
});

export type UnregisterPushDeviceByTokenResponse = z.infer<
  typeof unregisterPushDeviceByTokenResponseSchema
>;

export const pushDeviceResponseSchema = z
  .object({
    deviceId: z.string().describe("기기 식별자"),
    platform: z
      .enum(PUSH_DEVICE_PLATFORM)
      .describe("deviceId 접두어(ios_·android_)로 서버가 정한 플랫폼"),
    permission: pushPermissionSchema,
    hasActiveToken: z.boolean().describe("이 기기로 푸시를 보낼 수 있는 토큰이 있는지"),
    reportedAt: datetimeSchema.describe("마지막 보고 시각 (ISO 8601 UTC)"),
  })
  .meta({
    example: {
      deviceId: "ios_5F2C1E7A-0B9D-4C3E-8A11-2D4F6B8C9E01",
      platform: "IOS",
      permission: { status: "GRANTED", canAskAgain: false },
      hasActiveToken: true,
      reportedAt: "2026-11-04T03:41:40.598Z",
    },
  });

export type PushDeviceResponse = z.infer<typeof pushDeviceResponseSchema>;

export const markReadResponseSchema = z
  .object({
    message: z.string().describe("응답 메시지"),
    readCount: z.number().int().nonnegative().describe("읽음 처리된 알림 수 (음이 아닌 정수)"),
  })
  .meta({
    example: {
      message: "알림을 읽음 처리했습니다.",
      readCount: 3,
    },
  });

export type MarkReadResponse = z.infer<typeof markReadResponseSchema>;

export const notificationOpenedResponseSchema = z.object({ opened: z.boolean() });
export type NotificationOpenedResponse = z.infer<typeof notificationOpenedResponseSchema>;

export const marketingPushOptOutResponseSchema = z.object({
  optedOut: z.literal(true),
  marketingPushWithdrawnAt: datetimeSchema
    .optional()
    .describe(
      "이번 요청을 처리한 서버 시각 (1.15.0+ 서버). 토큰 유효 여부를 숨기려고 항상 준다. 앱은 철회 결과 안내에 기기 시각 대신 이 값을 쓴다",
    ),
});
export type MarketingPushOptOutResponse = z.infer<typeof marketingPushOptOutResponseSchema>;
