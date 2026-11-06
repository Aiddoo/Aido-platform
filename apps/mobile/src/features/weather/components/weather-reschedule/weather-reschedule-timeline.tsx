import { toDateKey } from '@src/shared/date/instant';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import { getDeviceTimezone } from '@src/shared/infra/device-clock';
import { Box, HStack } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';

import { type HourlyForecastEntry, WeatherReportPolicy } from '../../domains/weather-report.model';
import { toUnitPosition } from '../../utils/weather-bar.geometry';

const CHART_HEIGHT = 40;
const MIN_BAR_HEIGHT = 2;

/** 오늘(기기 시간대) 남은 시간의 강수 확률 막대. 비 오는 시간은 진하게, 맑은 시간은 옅게 그린다. */
export function WeatherRescheduleTimeline({ hours }: { hours: HourlyForecastEntry[] }) {
  const { t } = useTranslation('weather');
  const todayKey = useTodayKey();
  const todayHours = hours.filter(
    (hour) => toDateKey(hour.startsAt, getDeviceTimezone()) === todayKey,
  );

  if (todayHours.length === 0) {
    return null;
  }
  return (
    <HStack
      align="end"
      gap={2}
      style={{ height: CHART_HEIGHT }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={t('reschedule.chartLabel')}
    >
      {todayHours.map((hour) => (
        <Box
          key={hour.startsAt.getTime()}
          flex={1}
          className={cn(
            'rounded-sm',
            WeatherReportPolicy.isWetHour(hour) ? 'bg-info' : 'bg-gray-3',
          )}
          style={{
            height: Math.max(
              MIN_BAR_HEIGHT,
              toUnitPosition(hour.precipitationChance, 0, 100) * CHART_HEIGHT,
            ),
          }}
        />
      ))}
    </HStack>
  );
}
