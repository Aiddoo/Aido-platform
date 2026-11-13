import { addMonthsToDateKey, getMonthStartDateKey, type DateKey } from '@src/shared/date/date-key';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useMemo, useReducer } from 'react';
import { match } from 'ts-pattern';

import { type CalendarDayCell, getPickerMonthWeeks } from '../utils/calendar-month.view-model';

interface DatePickerState {
  selectedDateKey: DateKey;
  /** 보이는 달의 1일 */
  displayMonthKey: DateKey;
}

type DatePickerAction =
  | { type: 'selectDate'; dateKey: DateKey }
  | { type: 'prevMonth' }
  | { type: 'nextMonth' };

function datePickerReducer(state: DatePickerState, action: DatePickerAction): DatePickerState {
  return match(action)
    .with({ type: 'selectDate' }, ({ dateKey }) => ({ ...state, selectedDateKey: dateKey }))
    .with({ type: 'prevMonth' }, () => ({
      ...state,
      displayMonthKey: addMonthsToDateKey(state.displayMonthKey, -1),
    }))
    .with({ type: 'nextMonth' }, () => ({
      ...state,
      displayMonthKey: addMonthsToDateKey(state.displayMonthKey, 1),
    }))
    .exhaustive();
}

/** 날짜 피커의 고른 날·보이는 달과 동작. 반복 시트가 폼 달력에 통째로 넘긴다 */
export interface DatePicker {
  selectedDateKey: DateKey;
  /** 보이는 달의 1일 */
  displayMonthKey: DateKey;
  weeks: CalendarDayCell[][];
  selectDate: (dateKey: DateKey) => void;
  goToPrevMonth: () => void;
  goToNextMonth: () => void;
}

interface UseDatePickerOptions {
  /** 처음 선택된 날짜이자 처음 보이는 달 */
  initialDateKey: DateKey;
}

export function useDatePicker({ initialDateKey }: UseDatePickerOptions): DatePicker {
  const { locale, timeZone } = useDateFormatContext();
  const [state, dispatch] = useReducer(datePickerReducer, {
    selectedDateKey: initialDateKey,
    displayMonthKey: getMonthStartDateKey(initialDateKey),
  });

  // 달·언어가 같으면 칸 글자를 다시 만들지 않아 날짜를 눌러도 Intl을 부르지 않는다
  const weeks = useMemo(
    () => getPickerMonthWeeks(state.displayMonthKey, { locale, timeZone }),
    [state.displayMonthKey, locale, timeZone],
  );
  return {
    selectedDateKey: state.selectedDateKey,
    displayMonthKey: state.displayMonthKey,
    weeks,
    selectDate: (dateKey: DateKey) => dispatch({ type: 'selectDate', dateKey }),
    goToPrevMonth: () => dispatch({ type: 'prevMonth' }),
    goToNextMonth: () => dispatch({ type: 'nextMonth' }),
  };
}
