import { i18n } from '@src/shared/i18n';

import { formatTodoDateLabel } from './format-todo-date-label';

afterEach(async () => {
  await i18n.changeLanguage('ko');
});

const createParams = (overrides?: Partial<Parameters<typeof formatTodoDateLabel>[0]>) => ({
  startDate: new Date('2025-03-15'),
  scheduledTime: undefined,
  isAllDay: true,
  ...overrides,
});

describe('formatTodoDateLabel', () => {
  describe('startDate 표시', () => {
    it('startDate가 오늘이면 "오늘"을 반환해야 한다', () => {
      // Given
      const params = createParams({ startDate: new Date(), isAllDay: true });

      // When
      const result = formatTodoDateLabel(params);

      // Then
      expect(result).toBe('오늘');
    });

    it('startDate가 오늘이 아니면 "M월 D일" 형식을 반환해야 한다', () => {
      // Given
      const params = createParams({
        startDate: new Date('2025-03-15'),
        isAllDay: true,
      });

      // When
      const result = formatTodoDateLabel(params);

      // Then
      expect(result).toBe('3월 15일');
    });
  });

  describe('시간 표시', () => {
    it('isAllDay가 true이면 시간을 표시하지 않아야 한다', () => {
      // Given
      const params = createParams({
        startDate: new Date('2025-03-15'),
        isAllDay: true,
        scheduledTime: '오전 9:00',
      });

      // When
      const result = formatTodoDateLabel(params);

      // Then
      expect(result).not.toContain('오전 9:00');
    });

    it('isAllDay가 false이고 scheduledTime이 있으면 시간을 포함해야 한다', () => {
      // Given
      const params = createParams({
        startDate: new Date('2025-03-15'),
        isAllDay: false,
        scheduledTime: '오전 9:00',
      });

      // When
      const result = formatTodoDateLabel(params);

      // Then
      expect(result).toBe('3월 15일 오전 9:00');
    });

    it('isAllDay가 false이고 scheduledTime이 없으면 시간을 표시하지 않아야 한다', () => {
      // Given
      const params = createParams({
        startDate: new Date('2025-03-15'),
        isAllDay: false,
        scheduledTime: undefined,
      });

      // When
      const result = formatTodoDateLabel(params);

      // Then
      expect(result).toBe('3월 15일');
    });
  });
});

describe('en 로케일', () => {
  it('startDate가 오늘이면 "Today"를 반환해야 한다', async () => {
    // Given
    await i18n.changeLanguage('en');
    const params = createParams({ startDate: new Date(), isAllDay: true });

    // When
    const result = formatTodoDateLabel(params);

    // Then
    expect(result).toBe('Today');
  });

  it('startDate가 오늘이 아니면 영어 월 표기("MMM D")를 반환해야 한다', async () => {
    // Given
    await i18n.changeLanguage('en');
    const params = createParams({ startDate: new Date('2025-03-15'), isAllDay: true });

    // When
    const result = formatTodoDateLabel(params);

    // Then
    expect(result).toBe('Mar 15');
  });
});
