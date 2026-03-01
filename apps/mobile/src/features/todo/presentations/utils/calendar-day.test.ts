import { getDatePickerDayStyle, getMonthViewDayStyle, isTodayHighlighted } from './calendar-day';

jest.mock('@src/shared/utils/date', () => ({
  isDateToday: jest.fn(),
  isSunday: jest.fn(),
  isSaturday: jest.fn(),
}));

import { isDateToday, isSaturday, isSunday } from '@src/shared/utils/date';

const mockIsDateToday = isDateToday as jest.Mock;
const mockIsSunday = isSunday as jest.Mock;
const mockIsSaturday = isSaturday as jest.Mock;

const DATE = new Date('2025-03-17'); // 임의 날짜 (월요일)

beforeEach(() => {
  mockIsDateToday.mockReturnValue(false);
  mockIsSunday.mockReturnValue(false);
  mockIsSaturday.mockReturnValue(false);
});

describe('getDatePickerDayStyle', () => {
  it('선택된 날짜는 항상 selected를 반환해야 한다', () => {
    // Given
    const input = { date: DATE, isSelected: true };

    // When
    const result = getDatePickerDayStyle(input);

    // Then
    expect(result).toBe('selected');
  });

  it('오늘이고 선택되지 않은 날짜는 today를 반환해야 한다', () => {
    // Given
    mockIsDateToday.mockReturnValue(true);
    const input = { date: DATE, isSelected: false };

    // When
    const result = getDatePickerDayStyle(input);

    // Then
    expect(result).toBe('today');
  });

  it('일요일이고 선택되지 않고 오늘이 아니면 sunday를 반환해야 한다', () => {
    // Given
    mockIsSunday.mockReturnValue(true);
    const input = { date: DATE, isSelected: false };

    // When
    const result = getDatePickerDayStyle(input);

    // Then
    expect(result).toBe('sunday');
  });

  it('토요일이고 선택되지 않고 오늘이 아니면 saturday를 반환해야 한다', () => {
    // Given
    mockIsSaturday.mockReturnValue(true);
    const input = { date: DATE, isSelected: false };

    // When
    const result = getDatePickerDayStyle(input);

    // Then
    expect(result).toBe('saturday');
  });

  it('평일이고 선택되지 않고 오늘이 아니면 default를 반환해야 한다', () => {
    // Given
    const input = { date: DATE, isSelected: false };

    // When
    const result = getDatePickerDayStyle(input);

    // Then
    expect(result).toBe('default');
  });

  describe('우선순위: selected > today > sunday > saturday > default', () => {
    it('선택됨 + 오늘 + 일요일 → selected', () => {
      // Given
      mockIsDateToday.mockReturnValue(true);
      mockIsSunday.mockReturnValue(true);
      const input = { date: DATE, isSelected: true };

      // When
      const result = getDatePickerDayStyle(input);

      // Then
      expect(result).toBe('selected');
    });

    it('오늘 + 일요일 + 미선택 → today (selected보다 today가 sunday보다 우선)', () => {
      // Given
      mockIsDateToday.mockReturnValue(true);
      mockIsSunday.mockReturnValue(true);
      const input = { date: DATE, isSelected: false };

      // When
      const result = getDatePickerDayStyle(input);

      // Then
      expect(result).toBe('today');
    });

    it('일요일 + 토요일 + 미선택 + 오늘 아님 → sunday (sunday가 saturday보다 우선)', () => {
      // Given
      mockIsSunday.mockReturnValue(true);
      mockIsSaturday.mockReturnValue(true);
      const input = { date: DATE, isSelected: false };

      // When
      const result = getDatePickerDayStyle(input);

      // Then
      expect(result).toBe('sunday');
    });
  });
});

describe('getMonthViewDayStyle', () => {
  it('선택된 날짜는 항상 selected를 반환해야 한다', () => {
    // Given
    const input = { date: DATE, isSelected: true };

    // When
    const result = getMonthViewDayStyle(input);

    // Then
    expect(result).toBe('selected');
  });

  it('일요일이고 선택되지 않으면 sunday를 반환해야 한다', () => {
    // Given
    mockIsSunday.mockReturnValue(true);
    const input = { date: DATE, isSelected: false };

    // When
    const result = getMonthViewDayStyle(input);

    // Then
    expect(result).toBe('sunday');
  });

  it('토요일이고 선택되지 않으면 saturday를 반환해야 한다', () => {
    // Given
    mockIsSaturday.mockReturnValue(true);
    const input = { date: DATE, isSelected: false };

    // When
    const result = getMonthViewDayStyle(input);

    // Then
    expect(result).toBe('saturday');
  });

  it('오늘이고 주말이 아니고 선택되지 않으면 today를 반환해야 한다', () => {
    // Given
    mockIsDateToday.mockReturnValue(true);
    const input = { date: DATE, isSelected: false };

    // When
    const result = getMonthViewDayStyle(input);

    // Then
    expect(result).toBe('today');
  });

  it('평일이고 선택되지 않고 오늘이 아니면 default를 반환해야 한다', () => {
    // Given
    const input = { date: DATE, isSelected: false };

    // When
    const result = getMonthViewDayStyle(input);

    // Then
    expect(result).toBe('default');
  });

  describe('우선순위: selected > sunday > saturday > today > default (DatePicker와 달리 sunday가 today보다 우선)', () => {
    it('선택됨 + 일요일 → selected', () => {
      // Given
      mockIsSunday.mockReturnValue(true);
      const input = { date: DATE, isSelected: true };

      // When
      const result = getMonthViewDayStyle(input);

      // Then
      expect(result).toBe('selected');
    });

    it('오늘 + 일요일 + 미선택 → sunday (MonthView에서는 sunday가 today보다 우선)', () => {
      // Given
      mockIsDateToday.mockReturnValue(true);
      mockIsSunday.mockReturnValue(true);
      const input = { date: DATE, isSelected: false };

      // When
      const result = getMonthViewDayStyle(input);

      // Then
      expect(result).toBe('sunday');
    });

    it('오늘 + 토요일 + 미선택 → saturday (MonthView에서는 saturday가 today보다 우선)', () => {
      // Given
      mockIsDateToday.mockReturnValue(true);
      mockIsSaturday.mockReturnValue(true);
      const input = { date: DATE, isSelected: false };

      // When
      const result = getMonthViewDayStyle(input);

      // Then
      expect(result).toBe('saturday');
    });

    it('일요일 + 토요일 + 미선택 + 오늘 아님 → sunday (sunday가 saturday보다 우선)', () => {
      // Given
      mockIsSunday.mockReturnValue(true);
      mockIsSaturday.mockReturnValue(true);
      const input = { date: DATE, isSelected: false };

      // When
      const result = getMonthViewDayStyle(input);

      // Then
      expect(result).toBe('sunday');
    });
  });
});

describe('isTodayHighlighted', () => {
  it('오늘이고 선택되지 않은 경우 true를 반환해야 한다', () => {
    // Given
    mockIsDateToday.mockReturnValue(true);
    const input = { date: DATE, isSelected: false };

    // When
    const result = isTodayHighlighted(input);

    // Then
    expect(result).toBe(true);
  });

  it('오늘이지만 선택된 경우 false를 반환해야 한다', () => {
    // Given
    mockIsDateToday.mockReturnValue(true);
    const input = { date: DATE, isSelected: true };

    // When
    const result = isTodayHighlighted(input);

    // Then
    expect(result).toBe(false);
  });

  it('오늘이 아니고 선택되지 않은 경우 false를 반환해야 한다', () => {
    // Given
    mockIsDateToday.mockReturnValue(false);
    const input = { date: DATE, isSelected: false };

    // When
    const result = isTodayHighlighted(input);

    // Then
    expect(result).toBe(false);
  });

  it('오늘이 아니고 선택된 경우 false를 반환해야 한다', () => {
    // Given
    mockIsDateToday.mockReturnValue(false);
    const input = { date: DATE, isSelected: true };

    // When
    const result = isTodayHighlighted(input);

    // Then
    expect(result).toBe(false);
  });
});
