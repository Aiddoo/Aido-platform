import { z } from "zod";

import {
  EXPO_PUSH_TOKEN_REGEX,
  NOTIFICATION_CATEGORY,
  NOTIFICATION_LIMITS,
  PUSH_DEVICE_ID_MAX_LENGTH,
  PUSH_PERMISSION_STATUS,
} from "../../../vocabulary/notification.constants.js";

const expoPushTokenSchema = z
  .string()
  .min(1, "푸시 토큰이 필요합니다")
  .max(NOTIFICATION_LIMITS.MAX_PUSH_TOKEN_LENGTH, "푸시 토큰이 너무 깁니다")
  .regex(EXPO_PUSH_TOKEN_REGEX, "유효하지 않은 Expo 푸시 토큰 형식입니다");

const pushDeviceIdSchema = z
  .string()
  .min(1, "기기 ID가 필요합니다")
  .max(PUSH_DEVICE_ID_MAX_LENGTH, "기기 ID가 너무 깁니다");

const payloadVersionSchema = z.number().int().min(1).max(2);

/** 1.14.1 이하 앱이 쓰는 토큰 등록. 1.14.2부터는 reportPushDeviceSchema를 쓴다. */
export const registerPushTokenSchema = z.object({
  token: expoPushTokenSchema.describe("Expo 푸시 토큰 (ExponentPushToken[...] 형식)"),
  deviceId: pushDeviceIdSchema.optional().describe("기기 식별자 (선택, 최대 100자)"),
  payloadVersion: payloadVersionSchema.default(1).describe("푸시 payload 지원 버전"),
  appVersion: z.string().max(30).optional().describe("모바일 앱 버전"),
});

export type RegisterPushTokenInput = z.infer<typeof registerPushTokenSchema>;

/** 푸시 토큰 해제. deviceId를 생략하면 사용자의 모든 토큰을 해제한다. 등록할 때와 같은 기기 ID 규칙을 쓴다. */
export const unregisterPushTokenQuerySchema = z.object({
  deviceId: registerPushTokenSchema.shape.deviceId.describe(
    "특정 기기의 토큰만 해제. 미지정 시 모든 토큰 해제 (최대 100자)",
  ),
});

export type UnregisterPushTokenQuery = z.infer<typeof unregisterPushTokenQuerySchema>;

export const pushDeviceParamSchema = z.object({
  deviceId: pushDeviceIdSchema.describe(
    "앱이 만든 기기 식별자. ios_ 또는 android_로 시작 (최대 100자)",
  ),
});

export type PushDeviceParam = z.infer<typeof pushDeviceParamSchema>;

export const pushPermissionSchema = z
  .object({
    status: z
      .enum(PUSH_PERMISSION_STATUS)
      .describe("OS 알림 권한. iOS 임시 허용(provisional·ephemeral)은 PROVISIONAL"),
    canAskAgain: z.boolean().describe("앱이 시스템 권한 창을 다시 띄울 수 있는지"),
  })
  .describe("앱이 OS에서 읽은 알림 권한");

export type PushPermission = z.infer<typeof pushPermissionSchema>;

export const reportPushDeviceSchema = z
  .object({
    permission: pushPermissionSchema,
    token: expoPushTokenSchema
      .nullable()
      .describe("권한이 허용되고 발급에 성공했을 때의 Expo 푸시 토큰. 아니면 null"),
    payloadVersion: payloadVersionSchema.describe("앱이 해석할 수 있는 푸시 payload 버전"),
  })
  .describe(
    "기기 하나의 알림 권한과 토큰. 플랫폼은 deviceId 접두어, 앱 버전·시간대·언어는 요청 헤더에서 읽는다",
  )
  .meta({
    example: {
      permission: { status: "DENIED", canAskAgain: false },
      token: null,
      payloadVersion: 2,
    },
  });

export type ReportPushDeviceInput = z.infer<typeof reportPushDeviceSchema>;

export const markNotificationReadSchema = z.object({
  notificationId: z.coerce
    .number()
    .int()
    .positive("유효하지 않은 알림 ID입니다")
    .describe("알림 ID (양의 정수)"),
});

export type MarkNotificationReadInput = z.infer<typeof markNotificationReadSchema>;

export const markNotificationsReadSchema = z.object({
  notificationIds: z
    .array(z.coerce.number().int().positive("유효하지 않은 알림 ID입니다"))
    .min(1, "최소 1개의 알림 ID가 필요합니다")
    .max(100, "한 번에 최대 100개까지 처리 가능합니다")
    .describe("알림 ID 배열 (1-100개, 양의 정수)"),
});

export type MarkNotificationsReadInput = z.infer<typeof markNotificationsReadSchema>;

export const getNotificationsQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1, "최소 1개 이상 조회해야 합니다")
    .max(
      NOTIFICATION_LIMITS.MAX_FETCH_LIMIT,
      `최대 ${NOTIFICATION_LIMITS.MAX_FETCH_LIMIT}개까지 조회 가능합니다`,
    )
    .default(NOTIFICATION_LIMITS.DEFAULT_FETCH_LIMIT)
    .describe("조회할 알림 개수 (1-100, 기본값: 20)"),
  cursor: z.coerce
    .number()
    .int()
    .nonnegative("유효하지 않은 커서입니다")
    .optional()
    .describe("페이지네이션 커서 (선택, 0 이상의 정수)"),
  unreadOnly: z
    .union([z.boolean(), z.string()])
    .transform((val) => val === true || val === "true")
    .default(false)
    .describe("읽지 않은 알림만 조회 여부 (기본값: false)"),
  category: z
    .enum(["ALL", "NOTICE", "TODO", "SOCIAL"] as const)
    .default(NOTIFICATION_CATEGORY.ALL)
    .describe(
      "알림 카테고리 필터 (ALL: 전체, NOTICE: 공지, TODO: 할일, SOCIAL: 소셜 / 기본값: ALL)",
    ),
});

export type GetNotificationsQuery = z.infer<typeof getNotificationsQuerySchema>;

export const notificationIdParamSchema = z.object({
  id: z.coerce
    .number()
    .int()
    .positive("유효하지 않은 알림 ID입니다")
    .describe("알림 고유 ID (양의 정수, 예: 1)"),
});

export type NotificationIdParam = z.infer<typeof notificationIdParamSchema>;

export const markNotificationOpenedSchema = z.object({
  actionIdentifier: z.string().max(100).default("DEFAULT"),
  source: z.enum(["PUSH", "NOTIFICATION_CENTER"]).default("PUSH"),
});

export type MarkNotificationOpenedInput = z.infer<typeof markNotificationOpenedSchema>;

export const marketingPushOptOutSchema = z.object({
  token: z.string().min(1).max(2048).describe("서명된 광고성 푸시 수신 철회 토큰"),
});

export type MarketingPushOptOutInput = z.infer<typeof marketingPushOptOutSchema>;
