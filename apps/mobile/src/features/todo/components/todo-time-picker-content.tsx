import DateTimePicker from '@react-native-community/datetimepicker';
import { useGetPreferenceQueryOptions } from '@src/features/preference/queries/get-preference-query-options';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useTranslation } from '@src/shared/i18n';
import { useLanguage } from '@src/shared/providers/language-provider';
import { Box, Flex, ListRow, Spacing, Text, VStack } from '@src/shared/ui';
import {
  formatTimeDisplay,
  getDateWithTime,
  getPickerLocale,
  toHHmm,
} from '@src/shared/utils/time';
import { useSuspenseQuery } from '@tanstack/react-query';
import { PressableFeedback, Switch } from 'heroui-native';
import { useState } from 'react';
import { Platform } from 'react-native';

import { DEFAULT_TODO_TIME } from '../constants/todo-default-time';
import { PickerHeader } from './picker-header';

const isIOS = Platform.OS === 'ios';

export interface TodoTimeValue {
  scheduledTime: string | undefined;
  isAllDay: boolean;
}

interface TodoTimePickerContentProps {
  /** 시간 선택 휠이 기준으로 삼는 할 일 날짜 */
  date: Date;
  value: TodoTimeValue;
  onChange: (value: TodoTimeValue) => void;
  onCancel: () => void;
}

export function TodoTimePickerContent({
  date,
  value,
  onChange,
  onCancel,
}: TodoTimePickerContentProps) {
  const draftDate = date;
  const { scheduledTime, isAllDay } = value;
  const { t } = useTranslation('todo');
  const { data: preference } = useSuspenseQuery(useGetPreferenceQueryOptions());
  const dateFormatContext = useDateFormatContext();
  const { resolvedLanguage } = useLanguage();
  const [localIsAllDay, setLocalIsAllDay] = useState(isAllDay);
  const [localTime, setLocalTime] = useState<string>(scheduledTime ?? DEFAULT_TODO_TIME);
  const [showAndroidPicker, setShowAndroidPicker] = useState(false);

  const handleConfirm = () => {
    onChange({ scheduledTime: localIsAllDay ? undefined : localTime, isAllDay: localIsAllDay });
  };

  return (
    <VStack>
      <PickerHeader title={t('picker.timeTitle')} onCancel={onCancel} onConfirm={handleConfirm} />

      <Spacing size={24} />

      <VStack className="overflow-hidden rounded-xl bg-gray-1" px={4} py={8} gap={8}>
        <ListRow
          contents={
            <ListRow.Texts
              type="1RowTypeA"
              top={t('picker.allDay')}
              topProps={{ size: 'b1', weight: 'medium', shade: 8 }}
            />
          }
          right={<Switch isSelected={localIsAllDay} onSelectedChange={setLocalIsAllDay} />}
          horizontalPadding="medium"
          verticalPadding="medium"
        />
        <ListRow
          contents={
            <ListRow.Texts
              type="1RowTypeA"
              top={t('picker.time')}
              topProps={{ size: 'b1', weight: 'medium', shade: 8 }}
            />
          }
          right={
            localIsAllDay ? (
              <PressableFeedback
                onPress={() => setLocalIsAllDay(false)}
                className="h-[34px] justify-center"
              >
                <Text size="b1" shade={7}>
                  {t('picker.selectTime')}
                </Text>
              </PressableFeedback>
            ) : isIOS ? (
              <Text size="b1" tone="brand" weight="medium">
                {formatTimeDisplay(localTime, preference.timeFormat, dateFormatContext)}
              </Text>
            ) : (
              <>
                <PressableFeedback
                  onPress={() => setShowAndroidPicker(true)}
                  className="h-[34px] justify-center"
                >
                  <Text size="b1" tone="brand" weight="medium">
                    {formatTimeDisplay(localTime, preference.timeFormat, dateFormatContext)}
                  </Text>
                </PressableFeedback>
                {showAndroidPicker && (
                  <DateTimePicker
                    value={getDateWithTime(draftDate, localTime, DEFAULT_TODO_TIME)}
                    mode="time"
                    display="spinner"
                    is24Hour={preference.timeFormat === 'TWENTY_FOUR_HOUR'}
                    onChange={(_event, date) => {
                      setShowAndroidPicker(false);
                      if (date) {
                        setLocalTime(toHHmm(date));
                      }
                    }}
                  />
                )}
              </>
            )
          }
          horizontalPadding="medium"
          verticalPadding="medium"
          isDisabled={localIsAllDay}
        />
        {!localIsAllDay && isIOS && (
          <Box className="items-center">
            <DateTimePicker
              value={getDateWithTime(draftDate, localTime, DEFAULT_TODO_TIME)}
              mode="time"
              display="spinner"
              locale={getPickerLocale(resolvedLanguage, preference.timeFormat)}
              onChange={(_event, date) => {
                if (date) {
                  setLocalTime(toHHmm(date));
                }
              }}
              style={{ height: 216 }}
            />
          </Box>
        )}
      </VStack>

      <Spacing size={8} />

      <Flex px={4} justify="center" align="center">
        <Text size="b3" shade={5}>
          {t('picker.reminderInfo')}
        </Text>
      </Flex>
    </VStack>
  );
}
