import DateTimePicker, {
  DateTimePickerAndroid,
  type IOSNativeProps,
} from '@react-native-community/datetimepicker';
import type { TimeFormat } from '@src/shared/date/format/date-format';
import { getPickerTimeOfDay, toPickerDate } from '@src/shared/date/native-date';
import type { TimeOfDay } from '@src/shared/date/time-of-day';
import { useLocaleContext } from '@src/shared/hooks/use-locale-context';
import { getTimePickerLocale } from '@src/shared/i18n/app-locales';

const TIME_SPINNER_HEIGHT = 216;

interface TimeSpinnerProps extends Omit<
  IOSNativeProps,
  | 'value'
  | 'onChange'
  | 'onValueChange'
  | 'mode'
  | 'display'
  | 'locale'
  | 'minimumDate'
  | 'maximumDate'
  | 'minuteInterval'
> {
  value: TimeOfDay;
  onChange: (value: TimeOfDay) => void;
  timeFormat: TimeFormat;
  minimum?: TimeOfDay;
  maximum?: TimeOfDay;
}

/** iOS 시각 휠. 시와 분만 주고받아 피커 날짜가 서머타임 전환일이어도 02:30이 03:30으로 밀리지 않는다 */
export function TimeSpinner({
  value,
  onChange,
  timeFormat,
  minimum,
  maximum,
  style,
  ...props
}: TimeSpinnerProps) {
  const { language } = useLocaleContext();

  return (
    <DateTimePicker
      {...props}
      value={toPickerDate(value)}
      mode="time"
      display="spinner"
      minuteInterval={1}
      locale={getTimePickerLocale(language, timeFormat)}
      minimumDate={minimum == null ? undefined : toPickerDate(minimum)}
      maximumDate={maximum == null ? undefined : toPickerDate(maximum)}
      onValueChange={(_event, date) => onChange(getPickerTimeOfDay(date))}
      style={[{ height: TIME_SPINNER_HEIGHT }, style]}
    />
  );
}

interface AndroidTimePickerOptions {
  value: TimeOfDay;
  timeFormat: TimeFormat;
}

/** Android 시스템 시각 대화상자. 고르면 그 시각, 닫으면 null이다. 범위를 받지 않아 호출부가 확인한다 */
export function openAndroidTimePicker({
  value,
  timeFormat,
}: AndroidTimePickerOptions): Promise<TimeOfDay | null> {
  return new Promise((resolve) => {
    DateTimePickerAndroid.open({
      value: toPickerDate(value),
      mode: 'time',
      display: 'spinner',
      minuteInterval: 1,
      is24Hour: timeFormat === 'TWENTY_FOUR_HOUR',
      onValueChange: (_event, date) => resolve(getPickerTimeOfDay(date)),
      onDismiss: () => resolve(null),
      onError: () => resolve(null),
    });
  });
}
