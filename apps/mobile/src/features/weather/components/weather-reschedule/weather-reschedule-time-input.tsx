import type { WeatherRescheduleReason } from '@aido/api/vocabulary';
import { formatClockTime, type TimeFormat } from '@src/shared/date/format/date-format';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useTranslation } from '@src/shared/i18n';
import { LabelChip, SettingsListGroup } from '@src/shared/ui';
import { RadioGroup } from 'heroui-native';
import type { ComponentProps } from 'react';

import type { RescheduleOption } from '../../domains/weather-report.model';
import { useTemperatureUnit } from '../../hooks/use-temperature-unit';
import { formatTemperature } from '../../utils/weather-temperature';

interface WeatherRescheduleTimeInputProps extends Omit<
  ComponentProps<typeof RadioGroup>,
  'value' | 'onValueChange' | 'children'
> {
  value: string;
  onValueChange: (startsAt: string) => void;
  options: RescheduleOption[];
  reason: WeatherRescheduleReason;
  timeFormat: TimeFormat;
}

/** 옮길 시각 후보. 값은 후보 정시의 ISO 문자열이고 첫 후보가 추천이다. */
export function WeatherRescheduleTimeInput({
  value,
  onValueChange,
  options,
  reason,
  timeFormat,
  ...props
}: WeatherRescheduleTimeInputProps) {
  return (
    <RadioGroup value={value} onValueChange={onValueChange} className="gap-0" {...props}>
      {options.map((option) => (
        <RescheduleTimeOption
          key={option.startsAt}
          option={option}
          reason={reason}
          timeFormat={timeFormat}
        />
      ))}
    </RadioGroup>
  );
}

interface RescheduleTimeOptionProps extends Omit<
  ComponentProps<typeof SettingsListGroup.Radio>,
  'value' | 'label' | 'description'
> {
  option: RescheduleOption;
  reason: WeatherRescheduleReason;
  timeFormat: TimeFormat;
}

function RescheduleTimeOption({ option, reason, timeFormat, ...props }: RescheduleTimeOptionProps) {
  const { t } = useTranslation('weather');
  const dateFormat = useDateFormatContext();
  const unit = useTemperatureUnit();
  const time = formatClockTime(option.startsAt, timeFormat, dateFormat);
  const description =
    reason === 'heat'
      ? t('reschedule.heat.option', {
          temperature: formatTemperature(option.apparentTemperature, unit),
        })
      : t('reschedule.option', { chance: option.precipitationChance });

  return (
    <SettingsListGroup.Radio
      value={option.startsAt}
      label={time}
      description={description}
      badge={
        option.isRecommended && (
          <LabelChip color="accent" label={t('reschedule.recommended')} pointerEvents="none" />
        )
      }
      {...props}
    />
  );
}
