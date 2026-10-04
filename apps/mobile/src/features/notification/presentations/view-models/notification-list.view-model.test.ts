import { createNotificationListResponseDto } from '../../__tests__/notification.factories';
import { toNotification } from '../../services/notification.mapper';
import { toNotificationListItems } from './notification-list.view-model';

describe('알림 목록 날짜 섹션', () => {
  test('자정이 지나면 같은 캐시 데이터의 오늘 섹션이 어제로 바뀐다', () => {
    // Given
    const dto = createNotificationListResponseDto().notifications[0];
    if (dto === undefined) throw new Error('알림 fixture가 필요합니다');
    const notification = { ...toNotification(dto), createdAt: new Date(2026, 9, 4, 23, 59) };
    // When
    const before = toNotificationListItems([notification], new Date(2026, 9, 4, 23, 59));
    const after = toNotificationListItems([notification], new Date(2026, 9, 5, 0, 0));
    // Then
    expect(before[0]).toEqual({ type: 'header', section: 'today' });
    expect(after[0]).toEqual({ type: 'header', section: 'yesterday' });
    expect(after[1]).toEqual({ type: 'item', notification });
  });

  test('같은 날짜 그룹은 헤더를 한 번만 만들고 원래 알림 순서를 유지한다', () => {
    // Given
    const dto = createNotificationListResponseDto().notifications[0];
    if (dto === undefined) throw new Error('알림 fixture가 필요합니다');
    const first = { ...toNotification(dto), id: 2, createdAt: new Date(2026, 9, 4, 13) };
    const second = { ...first, id: 1 };
    // When
    const items = toNotificationListItems([first, second], new Date(2026, 9, 4));
    // Then
    expect(items).toEqual([
      { type: 'header', section: 'today' },
      { type: 'item', notification: first },
      { type: 'item', notification: second },
    ]);
  });

  test('목록이 비면 날짜 헤더도 만들지 않는다', () => {
    // Given
    const notifications: [] = [];
    // When
    const items = toNotificationListItems(notifications, new Date(2026, 9, 4));
    // Then
    expect(items).toEqual([]);
  });
});
