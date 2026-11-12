import { PickerHeader } from '@src/features/planning/todo/components/picker-header';
import { formatTimeOfDay, type TimeFormat } from '@src/shared/date/format/date-format';
import { isTimeOfDayInRange, type TimeOfDay } from '@src/shared/date/time-of-day';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  HStack,
  openAndroidTimePicker,
  SettingsListGroup,
  TimeSpinner,
  useOpenSheet,
  VStack,
} from '@src/shared/ui';
import { useAppToast } from '@src/shared/ui/toast/use-app-toast';
import { type ComponentProps, type ReactNode, useState } from 'react';

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
  const dateFormatContext = useDateFormatContext();
  const toast = useAppToast();
  const openSheet = useOpenSheet();

  // Android 시각 선택기는 최소·최대 시각을 지원하지 않아 확인할 때 범위를 본다
  const commitInRange = (time: TimeOfDay) => {
    if (!isTimeOfDayInRange(time, { minimumTime, maximumTime })) {
      toast.warning(
        t('settings.timeOutOfRange', {
          start: formatTimeOfDay(minimumTime, timeFormat, dateFormatContext),
          end: formatTimeOfDay(maximumTime, timeFormat, dateFormatContext),
        }),
      );
      return;
    }
    onChange(time);
  };

  const handlePress = useSingleTap(async () => {
    if (onBeforeOpen != null && !onBeforeOpen()) {
      return;
    }

    if (process.env.EXPO_OS === 'android') {
      const picked = await openAndroidTimePicker({ value, timeFormat });
      if (picked != null) {
        commitInRange(picked);
      }
      return;
    }

    const picked = await openSheet<TimeOfDay>((close) => (
      <ConfirmableTimeSpinner
        title={itemProps.label}
        initialValue={value}
        timeFormat={timeFormat}
        minimum={minimumTime}
        maximum={maximumTime}
        onCancel={() => close()}
        onConfirm={close}
      />
    ));
    if (picked != null) {
      onChange(picked);
    }
  });

  return (
    <SettingsListGroup.Item
      {...itemProps}
      value={
        <HStack align="center" gap={4}>
          {accessory}
          <SettingsListGroup.Value>
            {formatTimeOfDay(value, timeFormat, dateFormatContext)}
          </SettingsListGroup.Value>
        </HStack>
      }
      onPress={handlePress}
    />
  );
}

interface ConfirmableTimeSpinnerProps extends Pick<
  ComponentProps<typeof TimeSpinner>,
  'timeFormat' | 'minimum' | 'maximum'
> {
  title: string;
  initialValue: TimeOfDay;
  onCancel: () => void;
  onConfirm: (time: TimeOfDay) => void;
}

/** 시트 안 iOS 휠. 돌리는 값은 초안이고 확인을 눌러야 바뀐다 */
function ConfirmableTimeSpinner({
  title,
  initialValue,
  onCancel,
  onConfirm,
  ...spinnerProps
}: ConfirmableTimeSpinnerProps) {
  const [draft, setDraft] = useState(initialValue);

  return (
    <VStack gap={24}>
      <PickerHeader title={title} onCancel={onCancel} onConfirm={() => onConfirm(draft)} />
      <Box className="items-center">
        <TimeSpinner {...spinnerProps} value={draft} onChange={setDraft} />
      </Box>
    </VStack>
  );
}
