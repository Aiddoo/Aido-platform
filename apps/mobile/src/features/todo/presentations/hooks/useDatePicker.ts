import {
  getMonthWeeks,
  getNextDay,
  getNextMonth,
  getPreviousMonth,
  isBeforeDay,
  isSameDay,
} from '@src/shared/utils/date';
import { useMemo, useReducer } from 'react';
import { match } from 'ts-pattern';

export interface DatePickerState {
  startDate: Date;
  endDate: Date | null;
  displayMonth: Date;
}

type DatePickerAction =
  | { type: 'selectDate'; date: Date }
  | { type: 'toggleRange'; enabled: boolean }
  | { type: 'prevMonth' }
  | { type: 'nextMonth' };

type PickerMode = 'single' | 'range' | 'reselect';

const getPickerMode = (state: DatePickerState): PickerMode => {
  if (state.endDate === null) return 'single';
  if (isSameDay(state.startDate, state.endDate)) return 'range';
  return 'reselect';
};

export const datePickerReducer = (
  state: DatePickerState,
  action: DatePickerAction,
): DatePickerState =>
  match(action)
    .with({ type: 'selectDate' }, ({ date }) =>
      match(getPickerMode(state))
        .with('single', () => ({ ...state, startDate: date }))
        .with('range', () =>
          isBeforeDay(date, state.startDate)
            ? { ...state, startDate: date }
            : { ...state, endDate: date },
        )
        .with('reselect', () => ({ ...state, startDate: date, endDate: date }))
        .exhaustive(),
    )
    .with({ type: 'toggleRange' }, ({ enabled }) => ({
      ...state,
      endDate: enabled ? getNextDay(state.startDate) : null,
    }))
    .with({ type: 'prevMonth' }, () => ({
      ...state,
      displayMonth: getPreviousMonth(state.displayMonth),
    }))
    .with({ type: 'nextMonth' }, () => ({
      ...state,
      displayMonth: getNextMonth(state.displayMonth),
    }))
    .exhaustive();

interface UseDatePickerParams {
  startDate: Date;
  endDate: Date | null;
}

export const useDatePicker = ({ startDate, endDate }: UseDatePickerParams) => {
  const [state, dispatch] = useReducer(datePickerReducer, {
    startDate,
    endDate,
    displayMonth: startDate,
  });

  const isRange = state.endDate !== null;
  const weeks = useMemo(() => getMonthWeeks(state.displayMonth), [state.displayMonth]);

  return {
    localStartDate: state.startDate,
    localEndDate: state.endDate,
    displayMonth: state.displayMonth,
    isRange,
    weeks,
    selectDate: (date: Date) => dispatch({ type: 'selectDate', date }),
    toggleRange: (enabled: boolean) => dispatch({ type: 'toggleRange', enabled }),
    goToPrevMonth: () => dispatch({ type: 'prevMonth' }),
    goToNextMonth: () => dispatch({ type: 'nextMonth' }),
  };
};

export type DatePicker = ReturnType<typeof useDatePicker>;
