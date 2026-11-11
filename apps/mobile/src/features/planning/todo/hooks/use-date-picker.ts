import { addLocalMonths } from '@src/shared/date/zoned';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useMemo, useReducer } from 'react';
import { match } from 'ts-pattern';

import { getMonthWeeks } from '../utils/calendar-grid';

interface DatePickerState {
  selectedDate: Date;
  displayMonth: Date;
}

type DatePickerAction =
  | { type: 'selectDate'; date: Date }
  | { type: 'prevMonth'; timeZone: string }
  | { type: 'nextMonth'; timeZone: string };

function datePickerReducer(state: DatePickerState, action: DatePickerAction): DatePickerState {
  return match(action)
    .with({ type: 'selectDate' }, ({ date }) => ({ ...state, selectedDate: date }))
    .with({ type: 'prevMonth' }, ({ timeZone }) => ({
      ...state,
      displayMonth: addLocalMonths(state.displayMonth, -1, timeZone),
    }))
    .with({ type: 'nextMonth' }, ({ timeZone }) => ({
      ...state,
      displayMonth: addLocalMonths(state.displayMonth, 1, timeZone),
    }))
    .exhaustive();
}

interface UseDatePickerOptions {
  /** 처음 선택된 날짜이자 처음 보이는 달 */
  initialDate: Date;
}

export function useDatePicker({ initialDate }: UseDatePickerOptions) {
  const { timeZone } = useDateFormatContext();
  const [state, dispatch] = useReducer(datePickerReducer, {
    selectedDate: initialDate,
    displayMonth: initialDate,
  });

  const weeks = useMemo(
    () => getMonthWeeks(state.displayMonth, timeZone),
    [state.displayMonth, timeZone],
  );

  return {
    selectedDate: state.selectedDate,
    displayMonth: state.displayMonth,
    weeks,
    selectDate: (date: Date) => dispatch({ type: 'selectDate', date }),
    goToPrevMonth: () => dispatch({ type: 'prevMonth', timeZone }),
    goToNextMonth: () => dispatch({ type: 'nextMonth', timeZone }),
  };
}

export type DatePicker = ReturnType<typeof useDatePicker>;
