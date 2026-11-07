import { getMonthWeeks } from '@src/features/planning/todo/utils/calendar-date';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import dayjs from 'dayjs';
import { useMemo, useReducer } from 'react';
import { match } from 'ts-pattern';

export interface DatePickerState {
  startDate: Date;
  displayMonth: Date;
}

type DatePickerAction =
  | { type: 'selectDate'; date: Date }
  | { type: 'prevMonth' }
  | { type: 'nextMonth' };

export function datePickerReducer(
  state: DatePickerState,
  action: DatePickerAction,
): DatePickerState {
  return match(action)
    .with({ type: 'selectDate' }, ({ date }) => ({ ...state, startDate: date }))
    .with({ type: 'prevMonth' }, () => ({
      ...state,
      displayMonth: dayjs(state.displayMonth).subtract(1, 'month').toDate(),
    }))
    .with({ type: 'nextMonth' }, () => ({
      ...state,
      displayMonth: dayjs(state.displayMonth).add(1, 'month').toDate(),
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
    goToPrevMonth: () => dispatch({ type: 'prevMonth' }),
    goToNextMonth: () => dispatch({ type: 'nextMonth' }),
  };
}

export type DatePicker = ReturnType<typeof useDatePicker>;
