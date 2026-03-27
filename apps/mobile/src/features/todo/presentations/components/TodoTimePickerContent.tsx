import DateTimePicker from '@react-native-community/datetimepicker';
import { useGetPreferenceQueryOptions } from '@src/features/auth/presentations/queries/use-get-preference-query-options';
import { Flex, ListRow, Spacing, Text, VStack } from '@src/shared/ui';
import { formatTimeDisplay, getDateWithTime, toHHmm } from '@src/shared/utils/time';
import { useSuspenseQuery } from '@tanstack/react-query';
import { PressableFeedback, Switch } from 'heroui-native';
import { useState } from 'react';
import { Platform, View } from 'react-native';
import { DEFAULT_TIME } from '../constants/todo.constant';
import { PickerHeader } from './PickerHeader';

const isIOS = Platform.OS === 'ios';

interface TodoTimePickerContentProps {
  draftDate: Date;
  scheduledTime: string | undefined;
  isAllDay: boolean;
  onConfirm: (scheduledTime: string | undefined, isAllDay: boolean) => void;
  onCancel: () => void;
}

export const TodoTimePickerContent = ({
  draftDate,
  scheduledTime,
  isAllDay,
  onConfirm,
  onCancel,
}: TodoTimePickerContentProps) => {
  const { data: preference } = useSuspenseQuery(useGetPreferenceQueryOptions());
  const [localIsAllDay, setLocalIsAllDay] = useState(isAllDay);
  const [localTime, setLocalTime] = useState<string>(scheduledTime ?? DEFAULT_TIME);
  const [showAndroidPicker, setShowAndroidPicker] = useState(false);

  const handleConfirm = () => {
    onConfirm(localIsAllDay ? undefined : localTime, localIsAllDay);
  };

  return (
    <VStack>
      <PickerHeader title="시간" onCancel={onCancel} onConfirm={handleConfirm} />

      <Spacing size={24} />

      <VStack className="overflow-hidden rounded-xl bg-gray-1" px={4} py={8} gap={8}>
        <ListRow
          contents={
            <ListRow.Texts
              type="1RowTypeA"
              top="종일"
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
              top="시간"
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
                  시간 선택
                </Text>
              </PressableFeedback>
            ) : isIOS ? (
              <Text size="b1" tone="brand" weight="medium">
                {formatTimeDisplay(localTime, preference.timeFormat)}
              </Text>
            ) : (
              <>
                <PressableFeedback
                  onPress={() => setShowAndroidPicker(true)}
                  className="h-[34px] justify-center"
                >
                  <Text size="b1" tone="brand" weight="medium">
                    {formatTimeDisplay(localTime, preference.timeFormat)}
                  </Text>
                </PressableFeedback>
                {showAndroidPicker && (
                  <DateTimePicker
                    value={getDateWithTime(draftDate, localTime, DEFAULT_TIME)}
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
          disabled={localIsAllDay}
        />
        {!localIsAllDay && isIOS && (
          <View className="items-center">
            <DateTimePicker
              value={getDateWithTime(draftDate, localTime, DEFAULT_TIME)}
              mode="time"
              display="spinner"
              locale={preference.timeFormat === 'TWENTY_FOUR_HOUR' ? 'en_GB' : 'ko'}
              onChange={(_event, date) => {
                if (date) {
                  setLocalTime(toHHmm(date));
                }
              }}
              style={{ height: 216 }}
            />
          </View>
        )}
      </VStack>

      <Spacing size={8} />

      <Flex px={4} justify="center" align="center">
        <Text size="b3" shade={5} maxFontSizeMultiplier={1.3}>
          ⓘ 1시간 전, 10분 전에 알림을 보내드려요
        </Text>
      </Flex>
    </VStack>
  );
};
