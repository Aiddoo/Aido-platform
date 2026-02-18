import { formatTodoDateLabel } from './format-todo-date-label';

const createParams = (overrides?: Partial<Parameters<typeof formatTodoDateLabel>[0]>) => ({
  startDate: new Date('2025-03-15'),
  endDate: null,
  scheduledTime: undefined,
  isAllDay: true,
  ...overrides,
});

describe('formatTodoDateLabel', () => {
  describe('startDate 표시', () => {
    it('startDate가 오늘이면 "오늘"을 반환해야 한다', () => {
      // Given
      const params = createParams({ startDate: new Date(), endDate: null, isAllDay: true });

      // When
      const result = formatTodoDateLabel(params);

      // Then
      expect(result).toBe('오늘');
    });

    it('startDate가 오늘이 아니면 "M월 D일" 형식을 반환해야 한다', () => {
      // Given
      const params = createParams({
        startDate: new Date('2025-03-15'),
        endDate: null,
        isAllDay: true,
      });

      // When
      const result = formatTodoDateLabel(params);

      // Then
      expect(result).toBe('3월 15일');
    });
  });

  describe('endDate 범위 표시', () => {
    it('endDate가 null이면 범위를 표시하지 않아야 한다', () => {
      // Given
      const params = createParams({
        startDate: new Date('2025-03-15'),
        endDate: null,
        isAllDay: true,
      });

      // When
      const result = formatTodoDateLabel(params);

      // Then
      expect(result).toBe('3월 15일');
      expect(result).not.toContain(' - ');
    });

    it('endDate가 startDate와 같은 날이면 범위를 표시하지 않아야 한다', () => {
      // Given
      const params = createParams({
        startDate: new Date('2025-03-15'),
        endDate: new Date('2025-03-15'),
        isAllDay: true,
      });

      // When
      const result = formatTodoDateLabel(params);

      // Then
      expect(result).toBe('3월 15일');
      expect(result).not.toContain(' - ');
    });

    it('endDate가 같은 달이면 "D일" 형식으로 범위를 표시해야 한다', () => {
      // Given
      const params = createParams({
        startDate: new Date('2025-03-15'),
        endDate: new Date('2025-03-20'),
        isAllDay: true,
      });

      // When
      const result = formatTodoDateLabel(params);

      // Then
      expect(result).toBe('3월 15일 - 20일');
    });

    it('endDate가 다른 달이면 "M월 D일" 형식으로 범위를 표시해야 한다', () => {
      // Given
      const params = createParams({
        startDate: new Date('2025-03-15'),
        endDate: new Date('2025-04-05'),
        isAllDay: true,
      });

      // When
      const result = formatTodoDateLabel(params);

      // Then
      expect(result).toBe('3월 15일 - 4월 5일');
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
