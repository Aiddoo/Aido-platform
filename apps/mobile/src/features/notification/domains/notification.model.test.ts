import { type Notification, NotificationPolicy } from './notification.model';

const baseNotification: Notification = {
  id: 1,
  userId: 'cmreceiver000000000000001',
  type: 'CHEER_RECEIVED',
  title: '응원이 도착했어요',
  body: '오늘도 화이팅!',
  isRead: false,
  context: { cheerId: 7, friendId: 'cmsender0000000000000001' },
  routing: { senderId: 'cmsender0000000000000001', senderName: '지윤' },
  createdAt: new Date('2026-10-26T09:00:00.000Z'),
  readAt: null,
};

describe('NotificationPolicy.findReceivedCheer', () => {
  test('받은 응원 알림은 신고할 응원과 보낸 친구를 돌려준다', () => {
    // When
    const cheer = NotificationPolicy.findReceivedCheer(baseNotification);

    // Then
    expect(cheer).toEqual({
      cheerId: 7,
      senderId: 'cmsender0000000000000001',
      senderName: '지윤',
    });
  });

  test('보낸 사람 이름이 없는 이전 알림은 이름 없이 돌려준다', () => {
    // Given
    const legacy: Notification = { ...baseNotification, routing: undefined };

    // When & Then
    expect(NotificationPolicy.findReceivedCheer(legacy)?.senderName).toBeNull();
  });

  test('응원 ID가 없는 이전 알림이나 다른 종류의 알림은 신고 대상이 아니다', () => {
    // Given
    const legacyCheer: Notification = { ...baseNotification, context: { friendId: 'cmsender' } };
    const nudge: Notification = { ...baseNotification, type: 'NUDGE_RECEIVED' };

    // When & Then
    expect(NotificationPolicy.findReceivedCheer(legacyCheer)).toBeNull();
    expect(NotificationPolicy.findReceivedCheer(nudge)).toBeNull();
  });
});
