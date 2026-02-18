import { HStack } from '@src/shared/ui/HStack/HStack';
import { ListRow } from '@src/shared/ui/ListRow/ListRow';
import { Text } from '@src/shared/ui/Text/Text';
import { VStack } from '@src/shared/ui/VStack/VStack';
import { formatMonthDay } from '@src/shared/utils/date';
import { Chip } from 'heroui-native';
import { useState } from 'react';
import DatePicker from 'react-native-date-picker';

type DatePickerTarget = 'start' | 'end';

interface DateStepPanelProps {
  draftDate: Date;
  draftEndDate: Date | null;
  onStartDateChange: (date: Date) => void;
  onEndDateChange: (date: Date) => void;
  onEndDateClear: () => void;
  onEndDateInit: () => void;
}

export const DateStepPanel = ({
  draftDate,
  draftEndDate,
  onStartDateChange,
  onEndDateChange,
  onEndDateClear,
  onEndDateInit,
}: DateStepPanelProps) => {
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [datePickerTarget, setDatePickerTarget] = useState<DatePickerTarget>('start');

  const isRange = draftEndDate !== null;
  const formattedStartDateLabel = formatMonthDay(draftDate);
  const formattedEndDateLabel = formatMonthDay(draftEndDate ?? draftDate);

  const openDatePicker = (target: DatePickerTarget) => {
    setDatePickerTarget(target);
    setIsDatePickerOpen(true);
  };

  return (
    <>
      <VStack gap={8}>
        <Text size="b4" weight="semibold">
          날짜
        </Text>

        <HStack gap={8}>
          <Chip
            size="md"
            variant="soft"
            color={!isRange ? 'accent' : 'default'}
            onPress={onEndDateClear}
          >
            <Chip.Label>하루</Chip.Label>
          </Chip>
          <Chip
            size="md"
            variant="soft"
            color={isRange ? 'accent' : 'default'}
            onPress={onEndDateInit}
          >
            <Chip.Label>기간</Chip.Label>
          </Chip>
        </HStack>

        <VStack gap={8} className="rounded-xl border border-gray-3 bg-gray-1 p-3">
          <ListRow
            className="bg-transparent"
            verticalPadding="small"
            contents={
              <ListRow.Texts
                type="2RowTypeA"
                top="시작일"
                topProps={{ size: 'e1', shade: 5 }}
                bottom={formattedStartDateLabel}
                bottomProps={{ size: 'b4', weight: 'semibold' }}
              />
            }
            right={
              <Chip size="md" variant="soft" color="accent" onPress={() => openDatePicker('start')}>
                <Chip.Label>날짜 선택</Chip.Label>
              </Chip>
            }
          />

          <ListRow
            className="bg-transparent"
            verticalPadding="small"
            contents={
              <ListRow.Texts
                type="2RowTypeA"
                top="종료일"
                topProps={{ size: 'e1', shade: 5 }}
                bottom={isRange ? formattedEndDateLabel : '하루 일정'}
                bottomProps={{ size: 'b4', weight: 'semibold' }}
              />
            }
            right={
              <Chip
                size="md"
                variant="soft"
                color={isRange ? 'accent' : 'default'}
                onPress={() => {
                  if (isRange) {
                    openDatePicker('end');
                    return;
                  }
                  onEndDateInit();
                }}
              >
                <Chip.Label>{isRange ? '날짜 선택' : '기간으로 변경'}</Chip.Label>
              </Chip>
            }
          />
        </VStack>
      </VStack>

      <DatePicker
        modal
        mode="date"
        open={isDatePickerOpen}
        date={datePickerTarget === 'start' ? draftDate : (draftEndDate ?? draftDate)}
        locale="ko"
        title={datePickerTarget === 'start' ? '시작일 선택' : '종료일 선택'}
        confirmText="완료"
        cancelText="취소"
        onConfirm={(date) => {
          if (datePickerTarget === 'start') {
            onStartDateChange(date);
          } else {
            onEndDateChange(date);
          }
          setIsDatePickerOpen(false);
        }}
        onCancel={() => {
          setIsDatePickerOpen(false);
        }}
      />
    </>
  );
};
