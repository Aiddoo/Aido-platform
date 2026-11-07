import { type DatePickerState, datePickerReducer } from './use-date-picker';

const SYSTEM_TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

const createState = (overrides?: Partial<DatePickerState>): DatePickerState => ({
  startDate: new Date(2025, 2, 15),
  displayMonth: new Date(2025, 2, 1),
  ...overrides,
});

describe('datePickerReducer', () => {
  describe('selectDate', () => {
    it('선택한 날짜로 startDate를 변경해야 한다', () => {
      // Given
      const state = createState();

      // When
      const next = datePickerReducer(state, {
        type: 'selectDate',
        date: new Date(2025, 2, 20),
      });

      // Then
      expect(next.startDate).toEqual(new Date(2025, 2, 20));
    });
  });

  describe('prevMonth', () => {
    it('displayMonth를 이전 달로 변경해야 한다', () => {
      // Given
      const state = createState({ displayMonth: new Date(2025, 2, 1) });

      // When
      const next = datePickerReducer(state, { type: 'prevMonth', timeZone: SYSTEM_TIME_ZONE });

      // Then
      expect(next.displayMonth.getFullYear()).toBe(2025);
      expect(next.displayMonth.getMonth()).toBe(1);
    });
  });

  describe('nextMonth', () => {
    it('displayMonth를 다음 달로 변경해야 한다', () => {
      // Given
      const state = createState({ displayMonth: new Date(2025, 2, 1) });

      // When
      const next = datePickerReducer(state, { type: 'nextMonth', timeZone: SYSTEM_TIME_ZONE });

      // Then
      expect(next.displayMonth.getFullYear()).toBe(2025);
      expect(next.displayMonth.getMonth()).toBe(3);
    });
  });
});
