import { getMonthWeeks } from '@src/features/planning/todo/utils/calendar-date';
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

export const datePickerReducer = (
  state: DatePickerState,
  action: DatePickerAction,
): DatePickerState =>
  match(action)
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

interface UseDatePickerParams {
  startDate: Date;
}

export const useDatePicker = ({ startDate }: UseDatePickerParams) => {
  const [state, dispatch] = useReducer(datePickerReducer, {
    startDate,
    displayMonth: startDate,
  });

  const weeks = useMemo(() => getMonthWeeks(state.displayMonth), [state.displayMonth]);

  return {
    date: state.startDate,
    displayMonth: state.displayMonth,
    weeks,
    selectDate: (date: Date) => dispatch({ type: 'selectDate', date }),
    goToPrevMonth: () => dispatch({ type: 'prevMonth' }),
    goToNextMonth: () => dispatch({ type: 'nextMonth' }),
  };
};

export type DatePicker = ReturnType<typeof useDatePicker>;
