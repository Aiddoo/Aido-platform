import { type DatePickerState, datePickerReducer } from './useDatePicker';

const createState = (overrides?: Partial<DatePickerState>): DatePickerState => ({
  startDate: new Date('2025-03-15'),
  endDate: null,
  displayMonth: new Date('2025-03-01'),
  ...overrides,
});

describe('datePickerReducer', () => {
  describe('selectDate', () => {
    describe('single 모드 (endDate가 null)', () => {
      it('선택한 날짜로 startDate를 변경해야 한다', () => {
        // Given
        const state = createState();

        // When
        const next = datePickerReducer(state, { type: 'selectDate', date: new Date('2025-03-20') });

        // Then
        expect(next.startDate).toEqual(new Date('2025-03-20'));
        expect(next.endDate).toBeNull();
      });
    });

    describe('range 모드 (startDate === endDate)', () => {
      it('선택한 날짜가 startDate보다 이전이면 startDate를 변경해야 한다', () => {
        // Given
        const state = createState({
          startDate: new Date('2025-03-15'),
          endDate: new Date('2025-03-15'),
        });

        // When
        const next = datePickerReducer(state, { type: 'selectDate', date: new Date('2025-03-10') });

        // Then
        expect(next.startDate).toEqual(new Date('2025-03-10'));
        expect(next.endDate).toEqual(new Date('2025-03-15'));
      });

      it('선택한 날짜가 startDate 이후이면 endDate를 변경해야 한다', () => {
        // Given
        const state = createState({
          startDate: new Date('2025-03-15'),
          endDate: new Date('2025-03-15'),
        });

        // When
        const next = datePickerReducer(state, { type: 'selectDate', date: new Date('2025-03-20') });

        // Then
        expect(next.startDate).toEqual(new Date('2025-03-15'));
        expect(next.endDate).toEqual(new Date('2025-03-20'));
      });
    });

    describe('reselect 모드 (startDate !== endDate)', () => {
      it('선택한 날짜로 startDate와 endDate를 모두 재설정해야 한다', () => {
        // Given
        const state = createState({
          startDate: new Date('2025-03-10'),
          endDate: new Date('2025-03-20'),
        });

        // When
        const next = datePickerReducer(state, { type: 'selectDate', date: new Date('2025-03-25') });

        // Then
        expect(next.startDate).toEqual(new Date('2025-03-25'));
        expect(next.endDate).toEqual(new Date('2025-03-25'));
      });
    });
  });

  describe('toggleRange', () => {
    it('enabled가 true이면 startDate 다음 날로 endDate를 설정해야 한다', () => {
      // Given
      const state = createState({ startDate: new Date('2025-03-15'), endDate: null });

      // When
      const next = datePickerReducer(state, { type: 'toggleRange', enabled: true });

      // Then
      expect(next.endDate).toEqual(new Date('2025-03-16'));
    });

    it('enabled가 false이면 endDate를 null로 설정해야 한다', () => {
      // Given
      const state = createState({
        startDate: new Date('2025-03-15'),
        endDate: new Date('2025-03-16'),
      });

      // When
      const next = datePickerReducer(state, { type: 'toggleRange', enabled: false });

      // Then
      expect(next.endDate).toBeNull();
    });
  });

  describe('prevMonth', () => {
    it('displayMonth를 이전 달로 변경해야 한다', () => {
      // Given
      const state = createState({ displayMonth: new Date('2025-03-01') });

      // When
      const next = datePickerReducer(state, { type: 'prevMonth' });

      // Then
      expect(next.displayMonth.getFullYear()).toBe(2025);
      expect(next.displayMonth.getMonth()).toBe(1); // 0-indexed: 1 = February
    });
  });

  describe('nextMonth', () => {
    it('displayMonth를 다음 달로 변경해야 한다', () => {
      // Given
      const state = createState({ displayMonth: new Date('2025-03-01') });

      // When
      const next = datePickerReducer(state, { type: 'nextMonth' });

      // Then
      expect(next.displayMonth.getFullYear()).toBe(2025);
      expect(next.displayMonth.getMonth()).toBe(3); // 0-indexed: 3 = April
    });
  });
});
