import { createNotificationListResponseDto } from '../../__tests__/notification.factories';
import { toNotification } from '../../apis/notification.mapper';
import { toDateSectionedListItems } from './notification-list.view-model';

describe('알림 목록 날짜 섹션', () => {
  test('자정이 지나면 같은 캐시 데이터의 오늘 섹션이 어제로 바뀐다', () => {
    // Given
    const dto = createNotificationListResponseDto().notifications[0];
    if (dto === undefined) {
      throw new Error('알림 fixture가 필요합니다');
    }
    const notification = { ...toNotification(dto), createdAt: new Date('2026-10-04T14:59:00Z') };
    // When
    const before = toDateSectionedListItems([notification], '2026-10-04', 'Asia/Seoul');
    const after = toDateSectionedListItems([notification], '2026-10-05', 'Asia/Seoul');
    // Then
    expect(before[0]).toEqual({ type: 'header', section: 'today' });
    expect(after[0]).toEqual({ type: 'header', section: 'yesterday' });
    expect(after[1]).toEqual({ type: 'item', entry: notification });
  });

  test('같은 날짜 그룹은 헤더를 한 번만 만들고 원래 알림 순서를 유지한다', () => {
    // Given
    const dto = createNotificationListResponseDto().notifications[0];
    if (dto === undefined) {
      throw new Error('알림 fixture가 필요합니다');
    }
    const first = { ...toNotification(dto), id: 2, createdAt: new Date('2026-10-04T04:00:00Z') };
    const second = { ...first, id: 1 };
    // When
    const items = toDateSectionedListItems([first, second], '2026-10-04', 'Asia/Seoul');
    // Then
    expect(items).toEqual([
      { type: 'header', section: 'today' },
      { type: 'item', entry: first },
      { type: 'item', entry: second },
    ]);
  });

  test('목록이 비면 날짜 헤더도 만들지 않는다', () => {
    // Given
    const notifications: [] = [];
    // When
    const items = toDateSectionedListItems(notifications, '2026-10-04', 'Asia/Seoul');
    // Then
    expect(items).toEqual([]);
  });
});
