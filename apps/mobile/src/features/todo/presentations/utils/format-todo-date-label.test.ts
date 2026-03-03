import { formatTodoDateLabel } from './format-todo-date-label';

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

  describe('반복 기간 표시', () => {
    it('isRecurring이 true이고 repeatEndDate가 있으면 기간을 표시해야 한다', () => {
      // Given
      const params = createParams({
        startDate: new Date('2025-03-15'),
        isRecurring: true,
        repeatEndDate: new Date('2025-03-22'),
      });

      // When
      const result = formatTodoDateLabel(params);

      // Then
      expect(result).toBe('3월 15일 - 3월 22일');
    });

    it('isRecurring이 true이고 startDate가 오늘이면 "오늘 - M월 D일"을 반환해야 한다', () => {
      // Given
      const params = createParams({
        startDate: new Date(),
        isRecurring: true,
        repeatEndDate: new Date('2025-12-31'),
      });

      // When
      const result = formatTodoDateLabel(params);

      // Then
      expect(result).toBe('오늘 - 12월 31일');
    });

    it('isRecurring이 true이지만 repeatEndDate가 null이면 기간을 표시하지 않아야 한다', () => {
      // Given
      const params = createParams({
        startDate: new Date('2025-03-15'),
        isRecurring: true,
        repeatEndDate: null,
      });

      // When
      const result = formatTodoDateLabel(params);

      // Then
      expect(result).toBe('3월 15일');
    });

    it('isRecurring이 false이면 repeatEndDate가 있어도 기간을 표시하지 않아야 한다', () => {
      // Given
      const params = createParams({
        startDate: new Date('2025-03-15'),
        isRecurring: false,
        repeatEndDate: new Date('2025-03-22'),
      });

      // When
      const result = formatTodoDateLabel(params);

      // Then
      expect(result).toBe('3월 15일');
    });

    it('isRecurring이 undefined이면 기간을 표시하지 않아야 한다', () => {
      // Given
      const params = createParams({
        startDate: new Date('2025-03-15'),
        repeatEndDate: new Date('2025-03-22'),
      });

      // When
      const result = formatTodoDateLabel(params);

      // Then
      expect(result).toBe('3월 15일');
    });
  });
});
