import type { DayOfWeek } from '@aido/validators';
import { without } from 'es-toolkit';
import { useReducer } from 'react';
import { match } from 'ts-pattern';
import { getDayOfWeekFromDate } from '../utils/day-of-week';

const ALL_DAYS: DayOfWeek[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const WEEKDAYS: DayOfWeek[] = ['MON', 'TUE', 'WED', 'THU', 'FRI'];
const WEEKEND_DAYS: DayOfWeek[] = ['SAT', 'SUN'];

const isSameDaySet = (a: DayOfWeek[], b: DayOfWeek[]): boolean =>
  a.length === b.length && b.every((d) => a.includes(d));

export interface RepeatSettingState {
  isEnabled: boolean;
  selectedDays: DayOfWeek[];
  endDate: Date | null;
}

type RepeatSettingAction =
  | { type: 'toggle'; enabled: boolean; startDate: Date }
  | { type: 'toggleDay'; day: DayOfWeek }
  | { type: 'toggleAllDays' }
  | { type: 'toggleWeekdays' }
  | { type: 'toggleWeekends' }
  | { type: 'setEndDate'; date: Date }
  | { type: 'clearEndDate' };

const autoSelectStartDay = (startDate: Date): DayOfWeek[] => {
  const dayOfWeek = getDayOfWeekFromDate(startDate);
  return dayOfWeek ? [dayOfWeek] : [];
};

export const repeatSettingReducer = (
  state: RepeatSettingState,
  action: RepeatSettingAction,
): RepeatSettingState =>
  match(action)
    .with({ type: 'toggle' }, ({ enabled, startDate }) => {
      if (!enabled) {
        return { ...state, isEnabled: false, selectedDays: [], endDate: null };
      }

      const selectedDays =
        state.selectedDays.length > 0 ? state.selectedDays : autoSelectStartDay(startDate);

      const defaultEnd = new Date(startDate);
      defaultEnd.setDate(defaultEnd.getDate() + 7);

      return { ...state, isEnabled: true, selectedDays, endDate: defaultEnd };
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
    .with({ type: 'toggleWeekdays' }, () => ({
      ...state,
      selectedDays: isSameDaySet(state.selectedDays, WEEKDAYS) ? [] : [...WEEKDAYS],
    }))
    .with({ type: 'toggleWeekends' }, () => ({
      ...state,
      selectedDays: isSameDaySet(state.selectedDays, WEEKEND_DAYS) ? [] : [...WEEKEND_DAYS],
    }))
    .with({ type: 'setEndDate' }, ({ date }) => ({
      ...state,
      endDate: date,
    }))
    .with({ type: 'clearEndDate' }, () => ({
      ...state,
      endDate: null,
    }))
    .exhaustive();

interface UseRepeatSettingParams {
  isEnabled?: boolean;
  selectedDays?: DayOfWeek[];
  endDate?: Date | null;
}

export const useRepeatSetting = ({ isEnabled, selectedDays, endDate }: UseRepeatSettingParams) => {
  const [state, dispatch] = useReducer(repeatSettingReducer, {
    isEnabled: isEnabled ?? false,
    selectedDays: selectedDays ?? [],
    endDate: endDate ?? null,
  });

  return {
    isEnabled: state.isEnabled,
    selectedDays: state.selectedDays,
    endDate: state.endDate,
    isAllDaysSelected: state.selectedDays.length === 7,
    isWeekdaysSelected: isSameDaySet(state.selectedDays, WEEKDAYS),
    isWeekendsSelected: isSameDaySet(state.selectedDays, WEEKEND_DAYS),
    toggle: (enabled: boolean, startDate: Date) => dispatch({ type: 'toggle', enabled, startDate }),
    toggleDay: (day: DayOfWeek) => dispatch({ type: 'toggleDay', day }),
    toggleAllDays: () => dispatch({ type: 'toggleAllDays' }),
    toggleWeekdays: () => dispatch({ type: 'toggleWeekdays' }),
    toggleWeekends: () => dispatch({ type: 'toggleWeekends' }),
    setEndDate: (date: Date) => dispatch({ type: 'setEndDate', date }),
    clearEndDate: () => dispatch({ type: 'clearEndDate' }),
  };
};

export type RepeatSetting = ReturnType<typeof useRepeatSetting>;
