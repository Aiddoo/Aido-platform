import { z } from 'zod';

import { NOTIFICATION_LIMITS } from './notification.constants';

export const notificationTitleSchema = z
  .string()
  .max(
    NOTIFICATION_LIMITS.MAX_TITLE_LENGTH,
    `알림 제목은 최대 ${NOTIFICATION_LIMITS.MAX_TITLE_LENGTH}자입니다`,
  )
  .describe(`알림 제목 (최대 ${NOTIFICATION_LIMITS.MAX_TITLE_LENGTH}자)`);

export const notificationBodySchema = z
  .string()
  .max(
    NOTIFICATION_LIMITS.MAX_BODY_LENGTH,
    `알림 본문은 최대 ${NOTIFICATION_LIMITS.MAX_BODY_LENGTH}자입니다`,
  )
  .describe(`알림 본문 (최대 ${NOTIFICATION_LIMITS.MAX_BODY_LENGTH}자)`);

export const notificationContentSchema = z
  .object({
    title: notificationTitleSchema,
    body: notificationBodySchema,
  })
  .describe('알림 제목과 본문');

export type NotificationContent = z.infer<typeof notificationContentSchema>;
