import { addLocalMonths } from '@src/shared/date/local-day';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useMemo, useReducer } from 'react';
import { match } from 'ts-pattern';

import { getMonthWeeks } from '../utils/calendar-grid';

interface DatePickerState {
  startDate: Date;
  displayMonth: Date;
}

type DatePickerAction =
  | { type: 'selectDate'; date: Date }
  | { type: 'prevMonth'; timeZone: string }
  | { type: 'nextMonth'; timeZone: string };

function datePickerReducer(state: DatePickerState, action: DatePickerAction): DatePickerState {
  return match(action)
    .with({ type: 'selectDate' }, ({ date }) => ({ ...state, startDate: date }))
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

interface UseDatePickerParams {
  startDate: Date;
}

export function useDatePicker({ startDate }: UseDatePickerParams) {
  const { timeZone } = useDateFormatContext();
  const [state, dispatch] = useReducer(datePickerReducer, {
    startDate,
    displayMonth: startDate,
  });

  const weeks = useMemo(
    () => getMonthWeeks(state.displayMonth, timeZone),
    [state.displayMonth, timeZone],
  );

  return {
    date: state.startDate,
    displayMonth: state.displayMonth,
    weeks,
    selectDate: (date: Date) => dispatch({ type: 'selectDate', date }),
    goToPrevMonth: () => dispatch({ type: 'prevMonth', timeZone }),
    goToNextMonth: () => dispatch({ type: 'nextMonth', timeZone }),
  };
}

export type DatePicker = ReturnType<typeof useDatePicker>;
