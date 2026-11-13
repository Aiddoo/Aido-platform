import { getNowInstant } from '@src/shared/date/clock';
import { toEpochMs } from '@src/shared/date/instant';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
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
import { toWeatherHref } from '../utils/weather-link.view-model';
import { formatDegrees, toDisplayTemperature } from '../utils/weather-temperature.view-model';
import { WeatherIcon } from './weather-icon';

// 날씨 카드가 아니라 피드 머리 도구 막대에 있어 앱 기본 비율(useFontScaledSize)로 키운다
const BADGE_ICON_SIZE = 18;

function selectBadge(report: WeatherReport) {
  return {
    current: report.current,
    serviceName: report.attribution.serviceName,
  };
}

/** 헤더라 경계 대신 상태별로 그리고, 위치·리포트가 없어도 날씨 화면(권한 안내·다시 시도)으로 갈 배지를 남긴다 */
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

/** 헤더 폭에는 로고(1x 38pt)를 줄이지 않고 넣을 수 없어 날씨 화면으로 보내고 접근성 이름에 공급자를 밝힌다 */
WeatherForecastBadge.Item = function Item({
  current,
  serviceName,
}: {
  current: CurrentWeather;
  serviceName: string;
}) {
  const { t } = useTranslation('weather');
  const fontScaledSize = useFontScaledSize();
  const openWeather = useOpenBadgeWeather();
  const unit = useTemperatureUnit();
  const temperature = toDisplayTemperature(current.temperature, unit);

  return (
    <PressableFeedback
      onPress={openWeather}
      accessibilityRole="button"
      accessibilityLabel={t('badge.temperature', { temperature, serviceName })}
      hitSlop={4}
      className="min-h-11 min-w-16 justify-center"
    >
      <HStack align="center" gap={6} px={4}>
        <WeatherIcon
          condition={current.condition}
          isDaylight={current.isDaylight}
          width={fontScaledSize(BADGE_ICON_SIZE)}
          height={fontScaledSize(BADGE_ICON_SIZE)}
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
  const fontScaledSize = useFontScaledSize();
  const openWeather = useOpenBadgeWeather();

  return (
    <PressableFeedback
      onPress={openWeather}
      accessibilityRole="button"
      accessibilityLabel={t('badge.entry')}
      hitSlop={4}
      className="min-h-11 min-w-16 justify-center"
    >
      <HStack align="center" gap={6} px={4}>
        <WeatherIcon
          condition="PARTLY_CLOUDY"
          isDaylight
          width={fontScaledSize(BADGE_ICON_SIZE)}
          height={fontScaledSize(BADGE_ICON_SIZE)}
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

function useOpenBadgeWeather() {
  const push = useSingleTap(router.push);

  return () => push(toWeatherHref({ entry: 'feed_badge', openedAt: toEpochMs(getNowInstant()) }));
}
