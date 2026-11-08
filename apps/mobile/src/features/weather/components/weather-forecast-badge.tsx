import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { HStack, Text, TextSkeleton } from '@src/shared/ui';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { PressableFeedback } from 'heroui-native';
import { match } from 'ts-pattern';

import { WeatherLocationPolicy } from '../domains/weather-location.model';
import type { CurrentWeather, WeatherReport } from '../domains/weather-report.model';
import { useTemperatureUnit } from '../hooks/use-temperature-unit';
import { useWeatherLocation } from '../hooks/use-weather-location';
import { useGetWeatherReportQueryOptions } from '../queries/weather.queries';
import type { WeatherEntry } from '../schemas/weather-entry-params.schema';
import { formatDegrees, toDisplayTemperature } from '../utils/weather-temperature';
import { WeatherIcon } from './weather-icon';

const BADGE_ICON_SIZE = 18;

function selectBadge(report: WeatherReport) {
  return {
    current: report.current,
    serviceName: report.attribution.serviceName,
  };
}

/** 피드·메모 헤더의 날씨 진입점 */
export function WeatherForecastBadge() {
  const location = useWeatherLocation();
  const { data: badge, isPending } = useQuery({
    ...useGetWeatherReportQueryOptions(),
    select: selectBadge,
    enabled: WeatherLocationPolicy.shouldFetchReport(location),
  });

  return match(location)
    .with({ status: 'needsPermission' }, { status: 'denied' }, () => <WeatherForecastBadge.Entry />)
    .with({ status: 'checking' }, { status: 'unavailable' }, { status: 'ready' }, () => {
      if (badge == null) {
        return isPending ? <WeatherForecastBadge.Loading /> : <WeatherForecastBadge.Entry />;
      }
      return <WeatherForecastBadge.Item current={badge.current} serviceName={badge.serviceName} />;
    })
    .exhaustive();
}

WeatherForecastBadge.Item = function Item({
  current,
  serviceName,
}: {
  current: CurrentWeather;
  serviceName: string;
}) {
  const { t } = useTranslation('weather');
  const push = useSingleTap(router.push);
  const unit = useTemperatureUnit();
  const temperature = toDisplayTemperature(current.temperature, unit);

  return (
    <PressableFeedback
      onPress={() =>
        push({ pathname: '/weather', params: { entry: 'feed_badge' satisfies WeatherEntry } })
      }
      accessibilityRole="button"
      accessibilityLabel={t('badge.temperature', { temperature, serviceName })}
      hitSlop={4}
      className="min-h-11 min-w-16 justify-center"
    >
      <HStack align="center" gap={6} px={4}>
        <WeatherIcon
          condition={current.condition}
          isDaylight={current.isDaylight}
          width={BADGE_ICON_SIZE}
          height={BADGE_ICON_SIZE}
          variant="mono"
          colorClassName="text-gray-6"
        />
        <Text size="b4" weight="semibold" shade={8} className="tabular-nums">
          {formatDegrees(temperature)}
        </Text>
      </HStack>
    </PressableFeedback>
  );
};

WeatherForecastBadge.Entry = function Entry() {
  const { t } = useTranslation('weather');
  const push = useSingleTap(router.push);

  return (
    <PressableFeedback
      onPress={() =>
        push({ pathname: '/weather', params: { entry: 'feed_badge' satisfies WeatherEntry } })
      }
      accessibilityRole="button"
      accessibilityLabel={t('badge.entry')}
      hitSlop={4}
      className="min-h-11 min-w-16 justify-center"
    >
      <HStack align="center" gap={6} px={4}>
        <WeatherIcon
          condition="PARTLY_CLOUDY"
          isDaylight
          width={BADGE_ICON_SIZE}
          height={BADGE_ICON_SIZE}
          variant="mono"
          colorClassName="text-gray-6"
        />
        <Text size="b4" shade={6}>
          {t('badge.entry')}
        </Text>
      </HStack>
    </PressableFeedback>
  );
};

WeatherForecastBadge.Loading = function Loading() {
  return (
    <HStack align="center" className="min-h-11 min-w-16 px-1">
      <TextSkeleton size="b4" className="w-8" />
    </HStack>
  );
};
