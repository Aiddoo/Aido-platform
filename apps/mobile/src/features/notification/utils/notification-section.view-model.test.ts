import { toInstant } from '@src/shared/date/instant';
import { createDateKey } from '@src/testing/date-key';

import { createNotificationListResponseDto } from '../__tests__/notification.fixtures';
import { toNotification } from '../apis/notification.mapper';
import { getDateSectionKey, toDateSectionedListItems } from './notification-section.view-model';

describe('getDateSectionKey', () => {
  it('이번 주는 달력과 같은 일요일 시작 주다', () => {
    // Given
    // 일요일 오늘, ISO 주(월요일 시작)로는 같은 주였던 지난 수요일
    const sundayDateKey = createDateKey('2026-10-25');

    // When
    const section = getDateSectionKey(createDateKey('2026-10-21'), sundayDateKey);

    // Then
    expect(section).toBe('thisMonth');
    expect(getDateSectionKey(createDateKey('2026-10-26'), createDateKey('2026-10-31'))).toBe(
      'thisWeek',
    );
  });

  it('연말을 넘는 주와 어제를 날짜 key로 판단한다', () => {
    // Given
    // 2026-12-27(일)~2027-01-02(토) 주
    const newYearDateKey = createDateKey('2027-01-01');

    // When
    const sections = [
      getDateSectionKey(createDateKey('2026-12-31'), newYearDateKey),
      getDateSectionKey(createDateKey('2026-12-27'), newYearDateKey),
      getDateSectionKey(createDateKey('2026-12-26'), newYearDateKey),
      getDateSectionKey(createDateKey('2028-02-28'), createDateKey('2028-02-29')),
    ];

    // Then
    expect(sections).toEqual(['yesterday', 'thisWeek', 'earlier', 'yesterday']);
  });
});

describe('toDateSectionedListItems', () => {
  it('자정이 지나면 같은 캐시 데이터의 오늘 섹션이 어제로 바뀐다', () => {
    // Given
    const dto = createNotificationListResponseDto().notifications[0];
    if (dto == null) {
      throw new Error('알림 fixture가 필요합니다');
    }
    const notification = { ...toNotification(dto), createdAt: toInstant('2026-10-04T14:59:00Z') };

    // When
    const before = toDateSectionedListItems(
      [notification],
      createDateKey('2026-10-04'),
      'Asia/Seoul',
    );
    const after = toDateSectionedListItems(
      [notification],
      createDateKey('2026-10-05'),
      'Asia/Seoul',
    );

    // Then
    expect(before[0]).toEqual({ type: 'header', section: 'today' });
    expect(after[0]).toEqual({ type: 'header', section: 'yesterday' });
    expect(after[1]).toEqual({ type: 'item', entry: notification });
  });

  it('같은 날짜 그룹은 헤더를 한 번만 만들고 원래 알림 순서를 유지한다', () => {
    // Given
    const dto = createNotificationListResponseDto().notifications[0];
    if (dto == null) {
      throw new Error('알림 fixture가 필요합니다');
    }
    const first = { ...toNotification(dto), id: 2, createdAt: toInstant('2026-10-04T04:00:00Z') };
    const second = { ...first, id: 1 };

    // When
    const items = toDateSectionedListItems(
      [first, second],
      createDateKey('2026-10-04'),
      'Asia/Seoul',
    );

    // Then
    expect(items).toEqual([
      { type: 'header', section: 'today' },
      { type: 'item', entry: first },
      { type: 'item', entry: second },
    ]);
  });

  it('목록이 비면 날짜 헤더도 만들지 않는다', () => {
    // Given
    const notifications: [] = [];

    // When
    const items = toDateSectionedListItems(
      notifications,
      createDateKey('2026-10-04'),
      'Asia/Seoul',
    );

    // Then
    expect(items).toEqual([]);
  });
});
