import { Box } from '@src/shared/ui/Box/Box';
import { HStack } from '@src/shared/ui/HStack/HStack';
import { Text } from '@src/shared/ui/Text/Text';
import { VStack } from '@src/shared/ui/VStack/VStack';
import { cn } from '@src/shared/utils/cn';
import { formatTime } from '@src/shared/utils/date';
import { getDateWithTime, toHHmm } from '@src/shared/utils/time';
import { PressableFeedback } from 'heroui-native';
import { useState } from 'react';
import DatePicker from 'react-native-date-picker';
import { DEFAULT_TIME } from '../constants/todo.constant';

interface TimeStepPanelProps {
  draftDate: Date;
  draftIsAllDay: boolean;
  draftScheduledTime: string | undefined;
  onAllDayChange: (isAllDay: boolean) => void;
  onScheduledTimeChange: (time: string) => void;
}

export const TimeStepPanel = ({
  draftDate,
  draftIsAllDay,
  draftScheduledTime,
  onAllDayChange,
  onScheduledTimeChange,
}: TimeStepPanelProps) => {
  const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);

  const formattedTimeLabel = draftIsAllDay
    ? '종일'
    : formatTime(getDateWithTime(draftDate, draftScheduledTime, DEFAULT_TIME));

  const openTimePicker = () => {
    setIsTimePickerOpen(true);
  };

  const setAllDay = (nextIsAllDay: boolean) => {
    if (nextIsAllDay) {
      onAllDayChange(true);
      setIsTimePickerOpen(false);
      return;
    }

    openTimePicker();
  };

  return (
    <>
      <VStack gap={8}>
        <Text size="b4" weight="semibold">
          시간
        </Text>

        <VStack gap={6}>
          <TimeOptionRow
            label="종일"
            isSelected={draftIsAllDay}
            onPress={() => setAllDay(true)}
            accessibilityLabel="종일 선택"
          />

          <TimeOptionRow
            label="시간 지정"
            isSelected={!draftIsAllDay}
            helperText={!draftIsAllDay ? formattedTimeLabel : undefined}
            onPress={() => setAllDay(false)}
            accessibilityLabel="시간 지정 선택"
          />
        </VStack>
      </VStack>

      <DatePicker
        modal
        mode="time"
        open={isTimePickerOpen}
        date={getDateWithTime(draftDate, draftScheduledTime, DEFAULT_TIME)}
        locale="ko"
        title="시간 선택"
        confirmText="완료"
        cancelText="취소"
        onConfirm={(date) => {
          onScheduledTimeChange(toHHmm(date));
          onAllDayChange(false);
          setIsTimePickerOpen(false);
        }}
        onCancel={() => {
          setIsTimePickerOpen(false);
        }}
      />
    </>
  );
};

interface TimeOptionRowProps {
  label: string;
  isSelected: boolean;
  onPress: () => void;
  accessibilityLabel: string;
  helperText?: string;
}

const TimeOptionRow = ({
  label,
  isSelected,
  onPress,
  accessibilityLabel,
  helperText,
}: TimeOptionRowProps) => (
  <PressableFeedback
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel}
    accessibilityState={{ selected: isSelected }}
    className={cn(
      'rounded-xl border px-3 py-3',
      isSelected ? 'border-main/30 bg-main/5' : 'border-gray-3 bg-gray-1',
    )}
  >
    <HStack align="center" justify="between" gap={12}>
      <HStack align="center" gap={10}>
        <Box
          className={cn(
            'size-[18px] items-center justify-center rounded-full border-2',
            isSelected ? 'border-main' : 'border-gray-4',
          )}
        >
          {isSelected ? <Box className="size-[10px] rounded-full bg-main" /> : null}
        </Box>
        <Text
          size="b4"
          weight="medium"
          tone={isSelected ? 'brand' : undefined}
          shade={isSelected ? 9 : 7}
        >
          {label}
        </Text>
      </HStack>

      {helperText ? (
        <Text
          size="e1"
          weight="medium"
          tone={isSelected ? 'brand' : undefined}
          shade={isSelected ? 8 : 6}
        >
          {helperText}
        </Text>
      ) : null}
    </HStack>
  </PressableFeedback>
);
