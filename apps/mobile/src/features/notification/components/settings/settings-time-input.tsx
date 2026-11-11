import DateTimePicker, {
  type AndroidNativeProps,
  type IOSNativeProps,
} from '@react-native-community/datetimepicker';
import { PickerHeader } from '@src/features/planning/todo/components/picker-header';
import { formatTimeOfDay, type TimeFormat } from '@src/shared/date/format/date-format';
import { toPickerDate, getPickerTimeOfDay } from '@src/shared/date/native-date';
import { isTimeOfDayInRange, type TimeOfDay } from '@src/shared/date/time-of-day';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useLocaleContext } from '@src/shared/hooks/use-locale-context';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { getTimePickerLocale } from '@src/shared/i18n/app-locales';
import {
  BottomSheet,
  Box,
  HStack,
  SettingsListGroup,
  Text,
  useOverlay,
  VStack,
} from '@src/shared/ui';
import { useAppToast } from '@src/shared/ui/toast/use-app-toast';
import { type ComponentProps, type ReactNode, useState } from 'react';

const TIME_PICKER_HEIGHT = 216;

type TimePickerProps = Omit<IOSNativeProps, 'mode' | 'display' | 'minuteInterval'>;

function TimePicker({ style, ...props }: TimePickerProps) {
  return (
    <DateTimePicker
      {...props}
      mode="time"
      display="spinner"
      minuteInterval={1}
      style={[{ height: TIME_PICKER_HEIGHT }, style]}
    />
  );
}

interface TimePickerSheetContentProps extends Omit<
  TimePickerProps,
  'value' | 'onChange' | 'onValueChange'
> {
  title: string;
  initialValue: Date;
  onCancel: () => void;
  onConfirm: (date: Date) => void;
}

function TimePickerSheetContent({
  title,
  initialValue,
  onCancel,
  onConfirm,
  ...pickerProps
}: TimePickerSheetContentProps) {
  const [draft, setDraft] = useState(initialValue);

  return (
    <VStack gap={24}>
      <PickerHeader title={title} onCancel={onCancel} onConfirm={() => onConfirm(draft)} />
      <Box style={{ height: TIME_PICKER_HEIGHT, alignItems: 'center' }}>
        <TimePicker
          {...pickerProps}
          value={draft}
          onValueChange={(_event, date) => setDraft(date)}
        />
      </Box>
    </VStack>
  );
}

interface AndroidTimePickerProps extends Omit<
  AndroidNativeProps,
  'mode' | 'display' | 'minuteInterval' | 'onChange' | 'onValueChange'
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
      onValueChange={(_event, date) => {
        onDismiss();
        onConfirm(date);
      }}
      onDismiss={onDismiss}
    />
  );
}

interface SettingsTimeInputProps extends Omit<
  ComponentProps<typeof SettingsListGroup.Item>,
  'value' | 'right' | 'onPress'
> {
  value: TimeOfDay;
  onChange: (value: TimeOfDay) => void;
  minimumTime: TimeOfDay;
  maximumTime: TimeOfDay;
  timeFormat: TimeFormat;
  /** 시각 앞에 붙는 표시. 프리미엄 기능이면 왕관을 둔다 */
  accessory?: ReactNode;
  /** false를 돌려주면 피커를 열지 않는다. 프리미엄 안내처럼 열기 전 확인이 필요할 때 쓴다. */
  onBeforeOpen?: () => boolean;
}

export function SettingsTimeInput({
  value,
  onChange,
  minimumTime,
  maximumTime,
  onBeforeOpen,
  timeFormat,
  accessory,
  ...itemProps
}: SettingsTimeInputProps) {
  const { t } = useTranslation('notification');
  const { language } = useLocaleContext();
  const dateFormatContext = useDateFormatContext();
  const toast = useAppToast();
  const overlay = useOverlay();
  const [isAndroidPickerOpen, setIsAndroidPickerOpen] = useState(false);
  const minimumDate = toPickerDate(minimumTime);
  const maximumDate = toPickerDate(maximumTime);
  const commit = (date: Date) => onChange(getPickerTimeOfDay(date));

  // Android 시각 선택기는 최소·최대 시각을 지원하지 않아 확인할 때 범위를 본다
  const commitInRange = (date: Date) => {
    if (!isTimeOfDayInRange(getPickerTimeOfDay(date), { minimumTime, maximumTime })) {
      toast.warning(
        t('settings.timeOutOfRange', {
          start: formatTimeOfDay(minimumTime, timeFormat, dateFormatContext),
          end: formatTimeOfDay(maximumTime, timeFormat, dateFormatContext),
        }),
      );
      return;
    }
    commit(date);
  };

  const handlePress = useSingleTap(() => {
    if (onBeforeOpen != null && !onBeforeOpen()) {
      return;
    }

    if (process.env.EXPO_OS === 'android') {
      setIsAndroidPickerOpen(true);
      return;
    }

    overlay.open(({ isOpen, close, unmount }) => {
      const dismiss = () => {
        close();
        unmount();
      };

      return (
        <BottomSheet
          isOpen={isOpen}
          onOpenChange={(open) => {
            if (!open) {
              dismiss();
            }
          }}
        >
          <TimePickerSheetContent
            title={itemProps.label}
            initialValue={toPickerDate(value)}
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            locale={getTimePickerLocale(language, timeFormat)}
            onCancel={dismiss}
            onConfirm={(date) => {
              commit(date);
              dismiss();
            }}
          />
        </BottomSheet>
      );
    });
  });

  return (
    <>
      <SettingsListGroup.Item
        {...itemProps}
        value={
          <HStack align="center" gap={4}>
            {accessory}
            <Text size="b3" shade={7}>
              {formatTimeOfDay(value, timeFormat, dateFormatContext)}
            </Text>
          </HStack>
        }
        onPress={handlePress}
      />
      {isAndroidPickerOpen && (
        <AndroidTimePicker
          value={toPickerDate(value)}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          is24Hour={timeFormat === 'TWENTY_FOUR_HOUR'}
          onConfirm={commitInRange}
          onDismiss={() => setIsAndroidPickerOpen(false)}
        />
      )}
    </>
  );
}
