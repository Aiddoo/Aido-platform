import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { HStack, Text, TextSkeleton } from '@src/shared/ui';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { PressableFeedback } from 'heroui-native';
import { match } from 'ts-pattern';

import { type CurrentWeather, WeatherReportPolicy } from '../domains/weather-report.model';
import { useTemperatureUnit } from '../hooks/use-temperature-unit';
import { useWeatherLocation } from '../hooks/use-weather-location';
import { useGetWeatherReportQueryOptions } from '../queries/get-weather-report-query-options';
import { formatDegrees } from '../utils/format-degrees';
import { WeatherIcon } from './weather-icon';

const selectCurrent = (report: { current: CurrentWeather }) => report.current;

/**
 * 피드·메모 헤더의 날씨 진입점. 날씨 화면과 같은 리포트 key를 구독해 화면에 들어가면 캐시를 그대로 쓴다.
 * 헤더라 Suspense·오류 경계 대신 상태별로 그리고, 위치가 없거나 받지 못하면 아무것도 그리지 않는다.
 */
export function WeatherForecastBadge() {
  const location = useWeatherLocation();
  const { data: current, isPending } = useQuery({
    ...useGetWeatherReportQueryOptions(),
    select: selectCurrent,
    enabled: location.status !== 'needsPermission' && location.status !== 'denied',
  });

  return match(location)
    .with({ status: 'needsPermission' }, { status: 'denied' }, () => null)
    .with({ status: 'checking' }, { status: 'unavailable' }, { status: 'ready' }, () => {
      if (current == null) {
        return isPending ? <WeatherForecastBadge.Loading /> : null;
      }
      return <WeatherForecastBadge.Item current={current} />;
    })
    .exhaustive();
}

WeatherForecastBadge.Item = function Item({ current }: { current: CurrentWeather }) {
  const { t } = useTranslation('weather');
  const push = useSingleTap(router.push);
  const unit = useTemperatureUnit();
  const temperature = WeatherReportPolicy.displayTemperature(current.temperature, unit);

  return (
    <PressableFeedback
      onPress={() => push('/weather')}
      accessibilityRole="button"
      accessibilityLabel={t('badge.temperature', { temperature })}
      hitSlop={4}
      className="min-h-11 min-w-16 justify-center"
    >
      <HStack align="center" gap={6} px={4}>
        <WeatherIcon
          condition={current.condition}
          isDaylight={current.isDaylight}
          width={18}
          height={18}
          colorClassName="text-gray-6"
        />
        <Text size="b4" weight="semibold" shade={8} className="tabular-nums">
          {formatDegrees(temperature)}
        </Text>
      </HStack>
    </PressableFeedback>
  );
};

WeatherForecastBadge.Loading = function Loading() {
  return (
    <HStack align="center" px={4} className="min-h-11 min-w-16">
      <TextSkeleton size="b4" className="w-8" />
    </HStack>
  );
};
