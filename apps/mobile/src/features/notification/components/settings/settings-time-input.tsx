import DateTimePicker, {
  type AndroidNativeProps,
  type IOSNativeProps,
} from '@react-native-community/datetimepicker';
import { PickerHeader } from '@src/features/todo/components/picker-header';
import { useLanguage } from '@src/shared/providers/language-provider';
import {
  ArrowRightIcon,
  Box,
  HStack,
  KeyboardBottomSheet,
  Text,
  useOverlay,
  VStack,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import {
  formatReminderTime,
  getPickerLocale,
  timeToDate,
  type TimeFormat,
} from '@src/shared/utils/time';
import { PressableFeedback } from 'heroui-native';
import { type ComponentProps, type ReactNode, useState } from 'react';
import { Platform } from 'react-native';

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

interface SettingsTimeRowProps extends Omit<ComponentProps<typeof PressableFeedback>, 'children'> {
  label: string;
  description: string;
  hour: number;
  minute: number;
  timeFormat: TimeFormat;
  accessory?: ReactNode;
}

function SettingsTimeRow({
  label,
  description,
  hour,
  minute,
  timeFormat,
  isDisabled,
  accessory,
  className,
  ...pressableProps
}: SettingsTimeRowProps) {
  return (
    <PressableFeedback
      accessibilityRole="button"
      accessibilityLabel={label}
      isDisabled={isDisabled}
      className={cn('rounded-lg', className)}
      {...pressableProps}
    >
      <PressableFeedback.Highlight className="rounded-lg" />
      <HStack justify="between" align="center" className={cn(isDisabled && 'opacity-40')} gap={20}>
        <VStack className="flex-1">
          <HStack gap={8} align="center">
            <Text size="b2" shade={8}>
              {label}
            </Text>
            {accessory}
            <Text size="b2" className="text-main break-keep">
              {formatReminderTime(hour, minute, timeFormat)}
            </Text>
          </HStack>
          <Text size="b3" shade={6}>
            {description}
          </Text>
        </VStack>
        <ArrowRightIcon colorClassName="text-gray-6" />
      </HStack>
    </PressableFeedback>
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
            <Box style={{ height: 216, alignItems: 'center' }}>
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
            </Box>
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
