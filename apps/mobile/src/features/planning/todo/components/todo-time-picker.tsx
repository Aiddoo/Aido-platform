import DateTimePicker from '@react-native-community/datetimepicker';
import { useGetPreferenceQueryOptions } from '@src/features/identity/preference/queries/preference.queries';
import { formatHHmmTime } from '@src/shared/date/format/date-format';
import { getDateWithTime } from '@src/shared/date/native-date';
import { toHHmm } from '@src/shared/date/zoned';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useTranslation } from '@src/shared/i18n';
import { getTimePickerLocale } from '@src/shared/i18n/app-locales';
import { useLanguage } from '@src/shared/providers/language-provider';
import {
  Box,
  HStack,
  ListRow,
  SheetHeaderLayout,
  Spacing,
  Text,
  TextSkeleton,
  VStack,
} from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { ControlField, PressableFeedback, Skeleton } from 'heroui-native';
import { useState } from 'react';
import { match } from 'ts-pattern';

import { DEFAULT_TODO_TIME } from '../constants/todo-default-time.constants';
import { PickerHeader } from './picker-header';

const IS_IOS = process.env.EXPO_OS === 'ios';

interface TodoTimeValue {
  scheduledTime: string | null;
  isAllDay: boolean;
}

interface TodoTimePickerProps {
  /** 시간 선택 휠이 기준으로 삼는 할 일 날짜 */
  date: Date;
  value: TodoTimeValue;
  onChange: (value: TodoTimeValue) => void;
  onCancel: () => void;
  /** 고른 시간을 저장하는 동안 확인을 막는다 */
  isConfirmDisabled?: boolean;
}

export function TodoTimePicker({
  date,
  value,
  onChange,
  onCancel,
  isConfirmDisabled = false,
}: TodoTimePickerProps) {
  const { scheduledTime, isAllDay } = value;
  const { t } = useTranslation('todo');
  const { data: preference } = useSuspenseQuery(useGetPreferenceQueryOptions());
  const dateFormatContext = useDateFormatContext();
  const { resolvedLanguage } = useLanguage();
  const [localIsAllDay, setLocalIsAllDay] = useState(isAllDay);
  const [localTime, setLocalTime] = useState<string>(scheduledTime ?? DEFAULT_TODO_TIME);
  const [isAndroidPickerOpen, setIsAndroidPickerOpen] = useState(false);

  const handleConfirm = () => {
    onChange({ scheduledTime: localIsAllDay ? null : localTime, isAllDay: localIsAllDay });
  };

  return (
    <SheetHeaderLayout
      gap={24}
      header={
        <PickerHeader
          title={t('picker.timeTitle')}
          onCancel={onCancel}
          onConfirm={handleConfirm}
          isConfirmDisabled={isConfirmDisabled}
        />
      }
    >
      <VStack>
        <VStack className="gap-2 overflow-hidden rounded-xl bg-gray-1 dark:bg-gray-2 px-1 py-2">
          <ControlField
            isSelected={localIsAllDay}
            onSelectedChange={setLocalIsAllDay}
            className="px-4 py-2"
          >
            <Text size="b1" weight="medium" shade={8} className="flex-1">
              {t('picker.allDay')}
            </Text>
            <ControlField.Indicator />
          </ControlField>
          <ListRow
            contents={
              <ListRow.Texts
                type="1RowTypeA"
                top={t('picker.time')}
                topProps={{ size: 'b1', weight: 'medium', shade: 8 }}
              />
            }
            right={match({ localIsAllDay, isIOS: IS_IOS })
              .with({ localIsAllDay: true }, () => (
                <PressableFeedback
                  onPress={() => setLocalIsAllDay(false)}
                  className="h-[34px] justify-center"
                >
                  <Text size="b1" shade={7}>
                    {t('picker.selectTime')}
                  </Text>
                </PressableFeedback>
              ))
              .with({ isIOS: true }, () => (
                <Text size="b1" tone="brand" weight="medium">
                  {formatHHmmTime(localTime, preference.timeFormat, dateFormatContext)}
                </Text>
              ))
              .otherwise(() => (
                <>
                  <PressableFeedback
                    onPress={() => setIsAndroidPickerOpen(true)}
                    className="h-[34px] justify-center"
                  >
                    <Text size="b1" tone="brand" weight="medium">
                      {formatHHmmTime(localTime, preference.timeFormat, dateFormatContext)}
                    </Text>
                  </PressableFeedback>
                  {isAndroidPickerOpen && (
                    <DateTimePicker
                      value={getDateWithTime(date, localTime, DEFAULT_TODO_TIME)}
                      mode="time"
                      display="spinner"
                      is24Hour={preference.timeFormat === 'TWENTY_FOUR_HOUR'}
                      onValueChange={(_event, pickedTime) => {
                        setIsAndroidPickerOpen(false);
                        setLocalTime(toHHmm(pickedTime, dateFormatContext.timeZone));
                      }}
                      onDismiss={() => setIsAndroidPickerOpen(false)}
                    />
                  )}
                </>
              ))}
            horizontalPadding="medium"
            verticalPadding="medium"
            isDisabled={localIsAllDay}
          />
          {!localIsAllDay && IS_IOS && (
            <Box className="items-center">
              <DateTimePicker
                value={getDateWithTime(date, localTime, DEFAULT_TODO_TIME)}
                mode="time"
                display="spinner"
                locale={getTimePickerLocale(resolvedLanguage, preference.timeFormat)}
                onValueChange={(_event, pickedTime) => {
                  setLocalTime(toHHmm(pickedTime, dateFormatContext.timeZone));
                }}
                style={{ height: 216 }}
              />
            </Box>
          )}
        </VStack>

        <Spacing size={8} />

        <HStack className="px-1" justify="center" align="center">
          <Text size="b3" shade={5}>
            {t(localIsAllDay ? 'picker.reminderInfoAllDay' : 'picker.reminderInfo')}
          </Text>
        </HStack>
      </VStack>
    </SheetHeaderLayout>
  );
}

TodoTimePicker.Loading = function Loading() {
  return (
    <SheetHeaderLayout gap={24} header={<TextSkeleton size="b2" className="w-24 self-center" />}>
      <VStack className="overflow-hidden rounded-xl bg-gray-1 dark:bg-gray-2 px-1 py-2" gap={8}>
        <ListRow
          contents={<TextSkeleton size="b1" className="w-16" />}
          right={<Skeleton className="h-6 w-12 rounded-full" />}
          horizontalPadding="medium"
          verticalPadding="medium"
        />
        <ListRow
          contents={<TextSkeleton size="b1" className="w-16" />}
          right={<TextSkeleton size="b1" className="w-16" />}
          horizontalPadding="medium"
          verticalPadding="medium"
        />
      </VStack>
    </SheetHeaderLayout>
  );
};
