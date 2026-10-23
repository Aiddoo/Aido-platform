import DateTimePicker, {
  type AndroidNativeProps,
  type IOSNativeProps,
} from '@react-native-community/datetimepicker';
import { PickerHeader } from '@src/features/todo/components/picker-header';
import { useLanguage } from '@src/shared/providers/language-provider';
import { KeyboardBottomSheet, useOverlay, VStack } from '@src/shared/ui';
import { getPickerLocale, timeToDate } from '@src/shared/utils/time';
import { type ComponentProps, useState } from 'react';
import { Platform, View } from 'react-native';

import { SettingsTimeRow } from './settings-time-row';

type TimePickerProps = Omit<IOSNativeProps, 'mode' | 'display' | 'minuteInterval'>;

function TimePicker({ style, ...props }: TimePickerProps) {
  return (
    <DateTimePicker
      {...props}
      mode="time"
      display="spinner"
      minuteInterval={1}
      style={[{ height: 216 }, style]}
    />
  );
}

interface AndroidTimePickerProps extends Omit<
  AndroidNativeProps,
  'mode' | 'display' | 'minuteInterval' | 'onChange'
> {
  onConfirm: (date: Date) => void;
  onDismiss: () => void;
}

function AndroidTimePicker({ onConfirm, onDismiss, ...props }: AndroidTimePickerProps) {
  return (
    <DateTimePicker
      {...props}
      mode="time"
      display="spinner"
      minuteInterval={1}
      onChange={(event, date) => {
        onDismiss();
        if (event.type === 'set' && date) {
          onConfirm(date);
        }
      }}
    />
  );
}

export interface ClockTime {
  hour: number;
  minute: number;
}

interface SettingsTimeInputProps extends Omit<
  ComponentProps<typeof SettingsTimeRow>,
  'hour' | 'minute' | 'onPress'
> {
  value: ClockTime;
  onChange: (value: ClockTime) => void;
  minimumTime: ClockTime;
  maximumTime: ClockTime;
  /** false를 돌려주면 피커를 열지 않는다. 프리미엄 안내처럼 열기 전 확인이 필요할 때 쓴다. */
  onBeforeOpen?: () => boolean;
}

/** 설정 행을 누르면 시각 피커를 열고, 확인한 시각을 onChange로 돌려준다. */
export function SettingsTimeInput({
  value,
  onChange,
  minimumTime,
  maximumTime,
  onBeforeOpen,
  timeFormat,
  isDisabled,
  ...rowProps
}: SettingsTimeInputProps) {
  const { resolvedLanguage } = useLanguage();
  const overlay = useOverlay();
  const [androidPickerOpen, setAndroidPickerOpen] = useState(false);
  const minimumDate = timeToDate(minimumTime.hour, minimumTime.minute);
  const maximumDate = timeToDate(maximumTime.hour, maximumTime.minute);
  const commit = (date: Date) => onChange({ hour: date.getHours(), minute: date.getMinutes() });

  const handlePress = () => {
    if (isDisabled || (onBeforeOpen != null && !onBeforeOpen())) {
      return;
    }

    if (Platform.OS === 'android') {
      setAndroidPickerOpen(true);
      return;
    }

    let draft = timeToDate(value.hour, value.minute);

    overlay.open(({ isOpen, close, exit }) => {
      const dismiss = () => {
        close();
        exit();
      };

      return (
        <KeyboardBottomSheet
          isOpen={isOpen}
          onOpenChange={(open) => {
            if (!open) {
              dismiss();
            }
          }}
        >
          <VStack gap={24}>
            <PickerHeader
              title={rowProps.label}
              onCancel={dismiss}
              onConfirm={() => {
                commit(draft);
                dismiss();
              }}
            />
            <View style={{ height: 216, alignItems: 'center' }}>
              <TimePicker
                value={draft}
                minimumDate={minimumDate}
                maximumDate={maximumDate}
                onChange={(_event, date) => {
                  if (date) {
                    draft = date;
                  }
                }}
                locale={getPickerLocale(resolvedLanguage, timeFormat)}
              />
            </View>
          </VStack>
        </KeyboardBottomSheet>
      );
    });
  };

  return (
    <VStack>
      <SettingsTimeRow
        {...rowProps}
        hour={value.hour}
        minute={value.minute}
        timeFormat={timeFormat}
        isDisabled={isDisabled}
        onPress={handlePress}
      />
      {androidPickerOpen && (
        <AndroidTimePicker
          value={timeToDate(value.hour, value.minute)}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          is24Hour={timeFormat === 'TWENTY_FOUR_HOUR'}
          onConfirm={commit}
          onDismiss={() => setAndroidPickerOpen(false)}
        />
      )}
    </VStack>
  );
}
