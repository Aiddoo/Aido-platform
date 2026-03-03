import type { DayOfWeek } from '@aido/validators';
import { getMonthWeeks, getNextMonth, getPreviousMonth, isBeforeDay } from '@src/shared/utils/date';
import { without } from 'es-toolkit';
import { useMemo, useReducer } from 'react';
import { match } from 'ts-pattern';
import { getDayOfWeekFromDate } from '../utils/day-of-week';

const ALL_DAYS: DayOfWeek[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

export interface DatePickerState {
  startDate: Date;
  endDate: Date | null;
  displayMonth: Date;
  isRange: boolean;
  selectedDays: DayOfWeek[];
}

type DatePickerAction =
  | { type: 'selectDate'; date: Date }
  | { type: 'setRange'; enabled: boolean }
  | { type: 'toggleDay'; day: DayOfWeek }
  | { type: 'toggleAllDays' }
  | { type: 'prevMonth' }
  | { type: 'nextMonth' };

/** 단일 선택 | 종료일 대기 중 | 시작·종료 모두 선택됨 */
type SelectionPhase = 'single' | 'waiting-end' | 'both-selected';

const getSelectionPhase = (state: DatePickerState): SelectionPhase => {
  if (!state.isRange) return 'single';
  if (state.endDate === null) return 'waiting-end';
  return 'both-selected';
};

const autoSelectStartDay = (startDate: Date): DayOfWeek[] => {
  const dayOfWeek = getDayOfWeekFromDate(startDate);
  return dayOfWeek ? [dayOfWeek] : [];
};

export const datePickerReducer = (
  state: DatePickerState,
  action: DatePickerAction,
): DatePickerState =>
  match(action)
    .with({ type: 'selectDate' }, ({ date }) =>
      match(getSelectionPhase(state))
        .with('single', () => ({ ...state, startDate: date, endDate: null }))
        .with('waiting-end', () =>
          isBeforeDay(date, state.startDate)
            ? { ...state, startDate: date, endDate: null }
            : { ...state, endDate: date },
        )
        .with('both-selected', () => ({ ...state, startDate: date, endDate: null }))
        .exhaustive(),
    )
    .with({ type: 'setRange' }, ({ enabled }) => {
      if (!enabled) {
        return { ...state, isRange: false, endDate: null, selectedDays: [] };
      }
      const defaultEnd = new Date(state.startDate);
      defaultEnd.setDate(defaultEnd.getDate() + 7);

      const selectedDays =
        state.selectedDays.length > 0 ? state.selectedDays : autoSelectStartDay(state.startDate);

      return { ...state, isRange: true, endDate: defaultEnd, selectedDays };
    })
    .with({ type: 'toggleDay' }, ({ day }) => ({
      ...state,
      selectedDays: state.selectedDays.includes(day)
        ? without(state.selectedDays, day)
        : [...state.selectedDays, day],
    }))
    .with({ type: 'toggleAllDays' }, () => ({
      ...state,
      selectedDays: state.selectedDays.length === 7 ? [] : [...ALL_DAYS],
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
  endDate?: Date | null;
  isRange?: boolean;
  selectedDays?: DayOfWeek[];
}

export const useDatePicker = ({
  startDate,
  endDate,
  isRange,
  selectedDays,
}: UseDatePickerParams) => {
  const [state, dispatch] = useReducer(datePickerReducer, {
    startDate,
    endDate: endDate ?? null,
    displayMonth: startDate,
    isRange: isRange ?? false,
    selectedDays: selectedDays ?? [],
  });

  const weeks = useMemo(() => getMonthWeeks(state.displayMonth), [state.displayMonth]);

  return {
    localStartDate: state.startDate,
    localEndDate: state.endDate,
    displayMonth: state.displayMonth,
    isRange: state.isRange,
    selectedDays: state.selectedDays,
    isAllDaysSelected: state.selectedDays.length === 7,
    weeks,
    selectDate: (date: Date) => dispatch({ type: 'selectDate', date }),
    setRange: (enabled: boolean) => dispatch({ type: 'setRange', enabled }),
    toggleDay: (day: DayOfWeek) => dispatch({ type: 'toggleDay', day }),
    toggleAllDays: () => dispatch({ type: 'toggleAllDays' }),
    goToPrevMonth: () => dispatch({ type: 'prevMonth' }),
    goToNextMonth: () => dispatch({ type: 'nextMonth' }),
  };
};

export type DatePicker = ReturnType<typeof useDatePicker>;
