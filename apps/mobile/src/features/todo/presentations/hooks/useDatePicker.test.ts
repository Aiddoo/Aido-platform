import { type DatePickerState, datePickerReducer } from './useDatePicker';

const createState = (overrides?: Partial<DatePickerState>): DatePickerState => ({
  startDate: new Date('2025-03-15'),
  endDate: null,
  displayMonth: new Date('2025-03-01'),
  isRange: false,
  selectedDays: [],
  ...overrides,
});

describe('datePickerReducer', () => {
  describe('selectDate', () => {
    it('선택한 날짜로 startDate를 변경해야 한다', () => {
      // Given
      const state = createState();

      // When
      const next = datePickerReducer(state, { type: 'selectDate', date: new Date('2025-03-20') });

      // Then
      expect(next.startDate).toEqual(new Date('2025-03-20'));
    });
  });

  describe('setRange', () => {
    it('활성화하면 isRange=true, endDate=startDate+7일로 설정해야 한다', () => {
      // Given
      const state = createState({ startDate: new Date('2025-03-15') });

      // When
      const next = datePickerReducer(state, { type: 'setRange', enabled: true });

      // Then
      expect(next.isRange).toBe(true);
      expect(next.endDate).toEqual(new Date('2025-03-22'));
    });

    it('활성화할 때 selectedDays가 비어있으면 startDate의 요일을 자동 선택해야 한다', () => {
      // Given — 2025-03-15는 토요일
      const state = createState({ startDate: new Date('2025-03-15'), selectedDays: [] });

      // When
      const next = datePickerReducer(state, { type: 'setRange', enabled: true });

      // Then
      expect(next.selectedDays).toEqual(['SAT']);
    });

    it('활성화할 때 selectedDays가 이미 있으면 유지해야 한다', () => {
      // Given
      const state = createState({ selectedDays: ['MON', 'WED'] });

      // When
      const next = datePickerReducer(state, { type: 'setRange', enabled: true });

      // Then
      expect(next.selectedDays).toEqual(['MON', 'WED']);
    });

    it('비활성화하면 isRange=false, endDate=null, selectedDays=[]로 초기화해야 한다', () => {
      // Given
      const state = createState({
        isRange: true,
        endDate: new Date('2025-03-22'),
        selectedDays: ['MON', 'WED'],
      });

      // When
      const next = datePickerReducer(state, { type: 'setRange', enabled: false });

      // Then
      expect(next.isRange).toBe(false);
      expect(next.endDate).toBeNull();
      expect(next.selectedDays).toEqual([]);
    });
  });

  describe('toggleDay', () => {
    it('선택되지 않은 요일을 추가해야 한다', () => {
      // Given
      const state = createState({ selectedDays: ['MON'] });

      // When
      const next = datePickerReducer(state, { type: 'toggleDay', day: 'WED' });

      // Then
      expect(next.selectedDays).toEqual(['MON', 'WED']);
    });

    it('이미 선택된 요일을 제거해야 한다', () => {
      // Given
      const state = createState({ selectedDays: ['MON', 'WED'] });

      // When
      const next = datePickerReducer(state, { type: 'toggleDay', day: 'MON' });

      // Then
      expect(next.selectedDays).toEqual(['WED']);
    });
  });

  describe('toggleAllDays', () => {
    it('전부 선택되어 있으면 모두 해제해야 한다', () => {
      // Given
      const state = createState({
        selectedDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
      });

      // When
      const next = datePickerReducer(state, { type: 'toggleAllDays' });

      // Then
      expect(next.selectedDays).toEqual([]);
    });

    it('일부만 선택되어 있으면 전부 선택해야 한다', () => {
      // Given
      const state = createState({ selectedDays: ['MON', 'WED'] });

      // When
      const next = datePickerReducer(state, { type: 'toggleAllDays' });

      // Then
      expect(next.selectedDays).toEqual(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']);
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
