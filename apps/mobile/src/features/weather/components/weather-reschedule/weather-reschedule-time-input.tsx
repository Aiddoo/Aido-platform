import type { WeatherRescheduleReason } from '@aido/api';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useTranslation } from '@src/shared/i18n';
import { Box, IconRadioItem } from '@src/shared/ui';
import { formatClockTime, type TimeFormat } from '@src/shared/utils/date-format';
import { Chip, RadioGroup } from 'heroui-native';
import type { ComponentProps } from 'react';

import type { RescheduleOption } from '../../domains/weather-briefing.model';
import { WeatherReportPolicy } from '../../domains/weather-report.model';
import { useTemperatureUnit } from '../../hooks/use-temperature-unit';

interface WeatherRescheduleTimeInputProps extends Omit<
  ComponentProps<typeof RadioGroup>,
  'value' | 'onValueChange' | 'children'
> {
  value: string;
  onChange: (startsAt: string) => void;
  options: RescheduleOption[];
  reason: WeatherRescheduleReason;
  timeFormat: TimeFormat;
}

/** 옮길 시각 후보. 값은 후보 정시의 ISO 문자열이고 첫 후보가 추천이다. */
export function WeatherRescheduleTimeInput({
  value,
  onChange,
  options,
  reason,
  timeFormat,
  ...props
}: WeatherRescheduleTimeInputProps) {
  return (
    <RadioGroup value={value} onValueChange={onChange} className="gap-0" {...props}>
      {options.map((option) => (
        <RescheduleTimeOption
          key={option.startsAt.toISOString()}
          option={option}
          reason={reason}
          timeFormat={timeFormat}
        />
      ))}
    </RadioGroup>
  );
}

interface RescheduleTimeOptionProps extends Omit<
  ComponentProps<typeof IconRadioItem>,
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
          temperature: WeatherReportPolicy.degrees(
            WeatherReportPolicy.displayTemperature(option.apparentTemperature, unit),
          ),
        })
      : t('reschedule.option', { chance: option.precipitationChance });

  return (
    <Box>
      <IconRadioItem
        value={option.startsAt.toISOString()}
        label={time}
        description={description}
        {...props}
      />
      {option.isRecommended && (
        <Box className="absolute right-14 top-0 h-full justify-center" pointerEvents="none">
          <Chip size="sm" color="accent" variant="soft">
            <Chip.Label>{t('reschedule.recommended')}</Chip.Label>
          </Chip>
        </Box>
      )}
    </Box>
  );
}
