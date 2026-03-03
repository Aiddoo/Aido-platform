import { type RepeatSettingState, repeatSettingReducer } from './useRepeatSetting';

const createState = (overrides?: Partial<RepeatSettingState>): RepeatSettingState => ({
  isEnabled: false,
  selectedDays: [],
  endDate: null,
  ...overrides,
});

describe('repeatSettingReducer', () => {
  describe('toggle', () => {
    it('활성화하면 isEnabled=true로 전환하고 selectedDays가 비어있으면 시작일 요일을 자동 선택한다', () => {
      // Given
      const state = createState({ selectedDays: [] });

      // When
      const next = repeatSettingReducer(state, {
        type: 'toggle',
        enabled: true,
        startDate: new Date('2025-03-15'), // SAT
      });

      // Then
      expect(next.isEnabled).toBe(true);
      expect(next.selectedDays).toEqual(['SAT']);
    });

    it('활성화할 때 selectedDays가 이미 있으면 기존 값을 유지한다', () => {
      // Given
      const state = createState({ selectedDays: ['MON', 'WED'] });

      // When
      const next = repeatSettingReducer(state, {
        type: 'toggle',
        enabled: true,
        startDate: new Date('2025-03-15'),
      });

      // Then
      expect(next.selectedDays).toEqual(['MON', 'WED']);
    });

    it('활성화하면 endDate를 startDate+7일로 설정한다', () => {
      // Given
      const state = createState();

      // When
      const next = repeatSettingReducer(state, {
        type: 'toggle',
        enabled: true,
        startDate: new Date('2025-03-15'),
      });

      // Then
      expect(next.endDate).toEqual(new Date('2025-03-22'));
    });

    it('비활성화하면 isEnabled=false, selectedDays=[], endDate=null로 초기화한다', () => {
      // Given
      const state = createState({
        isEnabled: true,
        selectedDays: ['MON', 'WED'],
        endDate: new Date('2025-03-22'),
      });

      // When
      const next = repeatSettingReducer(state, {
        type: 'toggle',
        enabled: false,
        startDate: new Date('2025-03-15'),
      });

      // Then
      expect(next.isEnabled).toBe(false);
      expect(next.selectedDays).toEqual([]);
      expect(next.endDate).toBeNull();
    });
  });

  describe('setEndDate', () => {
    it('endDate를 지정한 날짜로 설정한다', () => {
      // Given
      const state = createState({ isEnabled: true, endDate: null });

      // When
      const next = repeatSettingReducer(state, {
        type: 'setEndDate',
        date: new Date('2025-03-25'),
      });

      // Then
      expect(next.endDate).toEqual(new Date('2025-03-25'));
    });
  });

  describe('clearEndDate', () => {
    it('endDate를 null로 초기화한다', () => {
      // Given
      const state = createState({ isEnabled: true, endDate: new Date('2025-03-22') });

      // When
      const next = repeatSettingReducer(state, { type: 'clearEndDate' });

      // Then
      expect(next.endDate).toBeNull();
    });
  });

  describe('toggleDay', () => {
    it('선택되지 않은 요일을 추가한다', () => {
      // Given
      const state = createState({ selectedDays: ['MON'] });

      // When
      const next = repeatSettingReducer(state, { type: 'toggleDay', day: 'WED' });

      // Then
      expect(next.selectedDays).toEqual(['MON', 'WED']);
    });

    it('이미 선택된 요일을 제거한다', () => {
      // Given
      const state = createState({ selectedDays: ['MON', 'WED'] });

      // When
      const next = repeatSettingReducer(state, { type: 'toggleDay', day: 'MON' });

      // Then
      expect(next.selectedDays).toEqual(['WED']);
    });
  });

  describe('toggleAllDays', () => {
    it('전부 선택되어 있으면 모두 해제한다', () => {
      // Given
      const state = createState({
        selectedDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
      });

      // When
      const next = repeatSettingReducer(state, { type: 'toggleAllDays' });

      // Then
      expect(next.selectedDays).toEqual([]);
    });

    it('일부만 선택되어 있으면 전부 선택한다', () => {
      // Given
      const state = createState({ selectedDays: ['MON', 'WED'] });

      // When
      const next = repeatSettingReducer(state, { type: 'toggleAllDays' });

      // Then
      expect(next.selectedDays).toEqual(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']);
    });
  });
});
