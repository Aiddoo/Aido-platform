import { useAppToast } from '@src/shared/hooks/useAppToast';
import { Button } from '@src/shared/ui/Button/Button';
import { HStack } from '@src/shared/ui/HStack/HStack';
import { VStack } from '@src/shared/ui/VStack/VStack';
import { isAfterDay, isBeforeDay } from '@src/shared/utils/date';
import { Chip } from 'heroui-native';
import { useReducer, useState } from 'react';
import { DateStepPanel } from './DateStepPanel';
import { TimeStepPanel } from './TimeStepPanel';

const DEFAULT_TIME = '09:00';
type SchedulePanel = 'date' | 'time';

export interface TodoDateTimeEditorValue {
  startDate: Date;
  endDate: Date | null;
  scheduledTime?: string | null;
  isAllDay: boolean;
}

interface TodoDateTimeEditorContentProps {
  initialValue: TodoDateTimeEditorValue;
  initialPanel?: SchedulePanel;
  onCancel: () => void;
  onConfirm: (value: TodoDateTimeEditorValue) => void;
}

type ScheduleDraftState = {
  startDate: Date;
  endDate: Date | null;
  scheduledTime: string | undefined;
  isAllDay: boolean;
};

type ScheduleAction =
  | { type: 'SET_START_DATE'; date: Date }
  | { type: 'SET_END_DATE'; date: Date }
  | { type: 'CLEAR_END_DATE' }
  | { type: 'INIT_END_DATE' }
  | { type: 'SET_SCHEDULED_TIME'; time: string }
  | { type: 'SET_ALL_DAY'; isAllDay: boolean };

function scheduleDraftReducer(
  state: ScheduleDraftState,
  action: ScheduleAction,
): ScheduleDraftState {
  switch (action.type) {
    case 'SET_START_DATE': {
      const endDate =
        state.endDate && isAfterDay(action.date, state.endDate) ? action.date : state.endDate;
      return { ...state, startDate: action.date, endDate };
    }
    case 'SET_END_DATE':
      return { ...state, endDate: action.date };
    case 'CLEAR_END_DATE':
      return { ...state, endDate: null };
    case 'INIT_END_DATE':
      return { ...state, endDate: state.endDate ?? state.startDate };
    case 'SET_SCHEDULED_TIME':
      return { ...state, scheduledTime: action.time };
    case 'SET_ALL_DAY':
      return { ...state, isAllDay: action.isAllDay };
  }
}

export const TodoDateTimeEditorContent = ({
  initialValue,
  initialPanel = 'time',
  onCancel,
  onConfirm,
}: TodoDateTimeEditorContentProps) => {
  const { warning } = useAppToast();

  const [draft, dispatch] = useReducer(scheduleDraftReducer, {
    startDate: initialValue.startDate,
    endDate: initialValue.endDate,
    scheduledTime: initialValue.scheduledTime ?? undefined,
    isAllDay: initialValue.isAllDay,
  });
  const [activePanel, setActivePanel] = useState<SchedulePanel>(initialPanel);

  const handleEndDateChange = (nextDate: Date) => {
    if (isBeforeDay(nextDate, draft.startDate)) {
      warning('종료일은 시작일 이후여야 해요');
      dispatch({ type: 'SET_END_DATE', date: draft.startDate });
      return;
    }
    dispatch({ type: 'SET_END_DATE', date: nextDate });
  };

  return (
    <VStack gap={20}>
      <VStack gap={10}>
        <HStack gap={8}>
          <Chip
            size="md"
            variant="soft"
            color={activePanel === 'date' ? 'accent' : 'default'}
            onPress={() => setActivePanel('date')}
          >
            <Chip.Label>날짜</Chip.Label>
          </Chip>
          <Chip
            size="md"
            variant="soft"
            color={activePanel === 'time' ? 'accent' : 'default'}
            onPress={() => setActivePanel('time')}
          >
            <Chip.Label>시간</Chip.Label>
          </Chip>
        </HStack>

        {activePanel === 'date' ? (
          <DateStepPanel
            draftDate={draft.startDate}
            draftEndDate={draft.endDate}
            onStartDateChange={(date) => dispatch({ type: 'SET_START_DATE', date })}
            onEndDateChange={handleEndDateChange}
            onEndDateClear={() => dispatch({ type: 'CLEAR_END_DATE' })}
            onEndDateInit={() => dispatch({ type: 'INIT_END_DATE' })}
          />
        ) : (
          <TimeStepPanel
            draftDate={draft.startDate}
            draftIsAllDay={draft.isAllDay}
            draftScheduledTime={draft.scheduledTime}
            onAllDayChange={(isAllDay) => dispatch({ type: 'SET_ALL_DAY', isAllDay })}
            onScheduledTimeChange={(time) => dispatch({ type: 'SET_SCHEDULED_TIME', time })}
          />
        )}
      </VStack>

      <HStack gap={8}>
        <Button
          size="large"
          display="block"
          variant="weak"
          color="dark"
          className="flex-1"
          onPress={onCancel}
        >
          취소
        </Button>
        <Button
          size="large"
          display="block"
          className="flex-1"
          onPress={() => {
            onConfirm({
              startDate: draft.startDate,
              endDate: draft.endDate,
              scheduledTime: draft.isAllDay ? undefined : (draft.scheduledTime ?? DEFAULT_TIME),
              isAllDay: draft.isAllDay,
            });
          }}
        >
          완료
        </Button>
      </HStack>
    </VStack>
  );
};
