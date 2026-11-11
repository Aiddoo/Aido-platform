import { toInstant } from '@src/shared/date/instant';

import type { Notification } from './notification.model';
import { NotificationPolicy } from './notification.model';

const baseNotification: Notification = {
  id: 1,
  userId: 'cmreceiver000000000000001',
  type: 'CHEER_RECEIVED',
  title: '응원이 도착했어요',
  body: '오늘도 화이팅!',
  isRead: false,
  context: { cheerId: 7, friendId: 'cmsender0000000000000001' },
  routing: { senderId: 'cmsender0000000000000001', senderName: '지윤' },
  createdAt: toInstant('2026-10-26T09:00:00.000Z'),
  readAt: null,
};

describe('isAiFeature', () => {
  it.each([
    ['WEEKLY_REPORT', true],
    ['MONTHLY_REPORT', true],
    ['AI_SUGGESTION', true],
    ['CHEER_RECEIVED', false],
    ['SYSTEM_NOTICE', false],
  ] as const)('%s 알림이 프리미엄 AI 기능인지는 %s다', (type, expected) => {
    // Given
    const notification = { ...baseNotification, type };

    // When
    const result = NotificationPolicy.isAiFeature(notification);

    // Then
    expect(result).toBe(expected);
  });
});

describe('findReceivedCheer', () => {
  it('받은 응원 알림은 신고할 응원과 보낸 친구를 반환한다', () => {
    // When
    const cheer = NotificationPolicy.findReceivedCheer(baseNotification);

    // Then
    expect(cheer).toEqual({
      cheerId: 7,
      senderId: 'cmsender0000000000000001',
      senderName: '지윤',
    });
  });

  it('보낸 사람 이름이 없는 이전 알림은 이름 없이 반환한다', () => {
    // Given
    const legacy: Notification = { ...baseNotification, routing: undefined };

    // When
    const cheer = NotificationPolicy.findReceivedCheer(legacy);

    // Then
    expect(cheer?.senderName).toBeNull();
  });

  it('응원 ID가 없는 이전 알림은 신고 대상이 아니다', () => {
    // Given
    const legacyCheer: Notification = { ...baseNotification, context: { friendId: 'cmsender' } };

    // When
    const cheer = NotificationPolicy.findReceivedCheer(legacyCheer);

    // Then
    expect(cheer).toBeNull();
  });

  it('응원이 아닌 다른 종류의 알림은 신고 대상이 아니다', () => {
    // Given
    const nudge: Notification = { ...baseNotification, type: 'NUDGE_RECEIVED' };

    // When
    const cheer = NotificationPolicy.findReceivedCheer(nudge);

    // Then
    expect(cheer).toBeNull();
  });
});
