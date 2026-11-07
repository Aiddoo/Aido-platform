import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { HStack, Text, TextSkeleton } from '@src/shared/ui';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { PressableFeedback } from 'heroui-native';
import { match } from 'ts-pattern';

import { WeatherLocationPolicy } from '../domains/weather-location.model';
import { useTemperatureUnit } from '../hooks/use-temperature-unit';
import { useWeatherLocation } from '../hooks/use-weather-location';
import { useGetWeatherReportQueryOptions } from '../queries/weather.queries';
import type { WeatherEntry } from '../schemas/weather-entry-params.schema';
import type { CurrentWeather, WeatherReport } from '../schemas/weather-report.schema';
import { formatDegrees, toDisplayTemperature } from '../utils/weather-temperature';
import { WeatherIcon } from './weather-icon';

function selectBadge(report: WeatherReport) {
  return {
    current: report.current,
    serviceName: report.attribution.serviceName,
  };
}

/**
 * 피드·메모 헤더의 날씨 진입점. 날씨 화면과 같은 리포트 key를 구독해 화면에 들어가면 캐시를 그대로 쓴다.
 * 헤더라 Suspense·오류 경계 대신 상태별로 그린다. 위치가 없거나 리포트를 받지 못해도 날씨 화면
 * (권한 안내·다시 시도)으로 들어갈 수 있게 진입 배지를 남긴다.
 */
export function WeatherForecastBadge() {
  const location = useWeatherLocation();
  const { data: badge, isPending } = useQuery({
    ...useGetWeatherReportQueryOptions(),
    select: selectBadge,
    enabled: WeatherLocationPolicy.canFetchReport(location.status),
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

/**
 * 헤더 왼쪽 자리는 아이콘과 온도만 들어가는 폭이라 로고(1x 38pt)를 줄이지 않고는 넣을 수 없다.
 * 로고를 줄이는 대신 날씨 화면(로고·출처 링크 표기)으로 보내고, 접근성 이름에 공급자를 밝힌다.
 */
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
          width={18}
          height={18}
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
          width={18}
          height={18}
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
    <HStack align="center" px={4} className="min-h-11 min-w-16">
      <TextSkeleton size="b4" className="w-8" />
    </HStack>
  );
};
