import type { TodoRepeat } from '../domains/todo-repeat.model';
import {
  isLegacySeriesRequest,
  type RepeatingTodoDraft,
  toLegacyRecurringRequest,
} from './todo-series.mapper';

const createDraft = (repeat: TodoRepeat, overrides: Partial<RepeatingTodoDraft> = {}) => ({
  title: '약 먹기',
  categoryId: 3,
  startDate: '2026-11-02',
  isAllDay: false,
  scheduledTime: '09:00',
  visibility: 'PUBLIC' as const,
  repeat,
  ...overrides,
});

describe('toLegacyRecurringRequest', () => {
  test('매주 날짜 종료는 요일과 종료일을 그대로 보낸다', () => {
    // Given
    const draft = createDraft({
      frequency: 'WEEKLY',
      interval: 1,
      weekdays: ['MON', 'FRI'],
      end: { type: 'UNTIL', date: '2026-12-31' },
    });

    // When
    const request = toLegacyRecurringRequest(draft);

    // Then
    expect(request).toMatchObject({
      daysOfWeek: ['MON', 'FRI'],
      endDate: '2026-12-31',
      scheduledTime: '09:00',
    });
  });

  test('매일은 7요일 매주로 보내고 종일이면 시간을 보내지 않는다', () => {
    // Given
    const draft = createDraft(
      { frequency: 'DAILY', end: { type: 'UNTIL', date: '2026-11-08' } },
      { isAllDay: true },
    );

    // When
    const request = toLegacyRecurringRequest(draft);

    // Then
    expect(request?.daysOfWeek).toHaveLength(7);
    expect(request?.scheduledTime).toBeUndefined();
  });

  test('횟수 종료는 n번째 회차 날짜를 종료일로 계산한다', () => {
    // Given
    const draft = createDraft({
      frequency: 'WEEKLY',
      interval: 1,
      weekdays: ['MON', 'WED'],
      end: { type: 'COUNT', count: 5 },
    });

    // When
    const request = toLegacyRecurringRequest(draft);

    // Then
    expect(request?.endDate).toBe('2026-11-16');
  });

  test('계속 반복은 기존 경로가 요구하는 종료일로 4주 뒤를 보낸다', () => {
    // Given
    const draft = createDraft({ frequency: 'DAILY', end: { type: 'NEVER' } });

    // When
    const request = toLegacyRecurringRequest(draft);

    // Then
    expect(request?.endDate).toBe('2026-11-30');
  });

  test('격주와 매월은 기존 경로로 표현할 수 없다', () => {
    // Given
    const biweekly = createDraft({
      frequency: 'WEEKLY',
      interval: 2,
      weekdays: ['MON'],
      end: { type: 'NEVER' },
    });
    const monthly = createDraft({ frequency: 'MONTHLY', monthDay: 2, end: { type: 'NEVER' } });

    // When
    const requests = [biweekly, monthly].map(toLegacyRecurringRequest);

    // Then
    expect(requests).toEqual([null, null]);
  });
});

describe('isLegacySeriesRequest', () => {
  test('이 할 일만 고치고 규칙을 건드리지 않을 때만 기존 경로로 보낸다', () => {
    // Given
    const thisOnly = isLegacySeriesRequest('THIS_ONLY');

    // When
    const results = [
      thisOnly,
      isLegacySeriesRequest('THIS_ONLY', null),
      isLegacySeriesRequest('THIS_AND_FOLLOWING'),
      isLegacySeriesRequest('ALL'),
    ];

    // Then
    expect(results).toEqual([true, false, false, false]);
  });
});
