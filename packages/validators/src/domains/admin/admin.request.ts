import { z } from 'zod';

import { notificationActionSchema } from '../notification/notification.payload';
import { BROADCAST_TARGET_FILTER, BROADCAST_TARGET_FILTERS } from './admin.constants';

/**
 * 전체/조건부 알림 브로드캐스트 요청
 */
export const broadcastNotificationSchema = z
  .object({
    title: z
      .string()
      .min(1, '제목을 입력해주세요')
      .max(100, '제목은 100자 이하로 입력해주세요')
      .describe('알림 제목'),
    body: z
      .string()
      .min(1, '내용을 입력해주세요')
      .max(500, '내용은 500자 이하로 입력해주세요')
      .describe('알림 내용'),
    targetFilter: z
      .enum(BROADCAST_TARGET_FILTERS)
      .default(BROADCAST_TARGET_FILTER.ALL)
      .describe(
        '알림 대상 필터 (ALL: 전체, WITH_PUSH_TOKEN: 푸시 토큰 보유, ACTIVE_LAST_7_DAYS: 7일 내 활동, ACTIVE_LAST_30_DAYS: 30일 내 활동, SUBSCRIBERS: 유료 구독)',
      ),
    action: notificationActionSchema
      .optional()
      .describe(
        '알림 클릭 시 액션 (BROWSER: 외부 브라우저, WEBVIEW: 인앱, DEEP_LINK: 내부 라우팅, NONE: 액션 없음)',
      ),
    force: z
      .boolean()
      .default(false)
      .describe(
        '사용자 푸시 수신 설정(푸시 OFF·야간 미동의·설정 없음)을 무시하고 강제 발송 (중요 공지용)',
      ),
  })
  .describe('전체/조건부 알림 브로드캐스트 요청')
  .meta({
    example: {
      title: '새로운 기능이 출시되었습니다!',
      body: '지금 바로 확인해보세요.',
      targetFilter: 'ALL',
    },
  });

export type BroadcastNotificationInput = z.infer<typeof broadcastNotificationSchema>;

/**
 * 특정 사용자 대상 알림 요청
 */
export const targetedNotificationSchema = z
  .object({
    title: z
      .string()
      .min(1, '제목을 입력해주세요')
      .max(100, '제목은 100자 이하로 입력해주세요')
      .describe('알림 제목'),
    body: z
      .string()
      .min(1, '내용을 입력해주세요')
      .max(500, '내용은 500자 이하로 입력해주세요')
      .describe('알림 내용'),
    userIds: z
      .array(z.string().cuid())
      .min(1, '최소 1명의 사용자를 선택해주세요')
      .max(1000, '최대 1000명까지 선택할 수 있습니다')
      .describe('알림 대상 사용자 ID 목록'),
    action: notificationActionSchema
      .optional()
      .describe(
        '알림 클릭 시 액션 (BROWSER: 외부 브라우저, WEBVIEW: 인앱, DEEP_LINK: 내부 라우팅, NONE: 액션 없음)',
      ),
    force: z
      .boolean()
      .default(false)
      .describe(
        '사용자 푸시 수신 설정(푸시 OFF·야간 미동의·설정 없음)을 무시하고 강제 발송 (중요 공지용)',
      ),
  })
  .describe('특정 사용자 대상 알림 요청')
  .meta({
    example: {
      title: '특별 할인 안내',
      body: '프리미엄 구독 50% 할인 중!',
      userIds: ['clz7x5p8k0001qz0z8z8z8z8z', 'clz7x5p8k0002qz0z8z8z8z8z'],
    },
  });

export type TargetedNotificationInput = z.infer<typeof targetedNotificationSchema>;
