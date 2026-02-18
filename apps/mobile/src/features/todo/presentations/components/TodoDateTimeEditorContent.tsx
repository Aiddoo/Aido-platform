import { useAppToast } from '@src/shared/hooks/useAppToast';
import { Button } from '@src/shared/ui/Button/Button';
import { HStack } from '@src/shared/ui/HStack/HStack';
import { VStack } from '@src/shared/ui/VStack/VStack';
import { isAfterDay, isBeforeDay } from '@src/shared/utils/date';
import { Chip } from 'heroui-native';
import { useState } from 'react';
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

export const TodoDateTimeEditorContent = ({
  initialValue,
  initialPanel = 'time',
  onCancel,
  onConfirm,
}: TodoDateTimeEditorContentProps) => {
  const { warning } = useAppToast();

  const [draftDate, setDraftDate] = useState(initialValue.startDate);
  const [draftEndDate, setDraftEndDate] = useState<Date | null>(initialValue.endDate);
  const [draftScheduledTime, setDraftScheduledTime] = useState<string | undefined>(
    initialValue.scheduledTime ?? undefined,
  );
  const [draftIsAllDay, setDraftIsAllDay] = useState(initialValue.isAllDay);
  const [activePanel, setActivePanel] = useState<SchedulePanel>(initialPanel);

  const setStartDate = (nextDate: Date) => {
    setDraftDate(nextDate);
    if (draftEndDate && isAfterDay(nextDate, draftEndDate)) {
      setDraftEndDate(nextDate);
    }
  };

  const setEndDate = (nextDate: Date) => {
    if (isBeforeDay(nextDate, draftDate)) {
      warning('종료일은 시작일 이후여야 해요');
      setDraftEndDate(draftDate);
      return;
    }
    setDraftEndDate(nextDate);
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
            draftDate={draftDate}
            draftEndDate={draftEndDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
            onEndDateClear={() => setDraftEndDate(null)}
            onEndDateInit={() => setDraftEndDate((prev) => prev ?? draftDate)}
          />
        ) : (
          <TimeStepPanel
            draftDate={draftDate}
            draftIsAllDay={draftIsAllDay}
            draftScheduledTime={draftScheduledTime}
            onAllDayChange={setDraftIsAllDay}
            onScheduledTimeChange={setDraftScheduledTime}
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
              startDate: draftDate,
              endDate: draftEndDate,
              scheduledTime: draftIsAllDay ? undefined : (draftScheduledTime ?? DEFAULT_TIME),
              isAllDay: draftIsAllDay,
            });
          }}
        >
          완료
        </Button>
      </HStack>
    </VStack>
  );
};
