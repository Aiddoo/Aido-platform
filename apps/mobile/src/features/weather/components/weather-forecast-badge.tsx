import { getNowInstant } from '@src/shared/date/clock';
import { toEpochMs } from '@src/shared/date/instant';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { HStack, Text, TextSkeleton } from '@src/shared/ui';
import { useQuery } from '@tanstack/react-query';
import { useIsFocused, useRouter } from 'expo-router';
import { PressableFeedback } from 'heroui-native';
import { match } from 'ts-pattern';

import type { CurrentWeather } from '../domains/current-weather.model';
import { shouldFetchReport } from '../domains/location-reading.model';
import { useTemperatureUnit } from '../hooks/use-temperature-unit';
import { useWeatherLocation } from '../hooks/use-weather-location';
import { useGetWeatherReportQueryOptions, WeatherReportSelect } from '../queries/weather.queries';
import { toWeatherHref } from '../schemas/weather-entry-params.schema';
import { formatDegrees, toDisplayTemperature } from '../utils/weather-temperature.view-model';
import { WeatherIcon } from './weather-icon';

// 날씨 카드가 아니라 피드 머리 도구 막대에 있어 앱 기본 비율(useFontScaledSize)로 키운다
const BADGE_ICON_SIZE = 18;

/** 헤더라 경계 대신 상태별로 그리고, 위치·리포트가 없어도 날씨 화면(권한 안내·다시 시도)으로 갈 배지를 남긴다 */
export function WeatherForecastBadge() {
  const location = useWeatherLocation();
  // 리포트 만료마다 다시 받는 폴링이 다른 탭·화면에 가려진 동안 돌지 않게 구독을 끊는다. 다시 보이면 낡은 리포트를 바로 받는다
  const isFocused = useIsFocused();
  const { data: badge, isPending } = useQuery({
    ...useGetWeatherReportQueryOptions(),
    select: WeatherReportSelect.badge,
    enabled: shouldFetchReport(location.status),
    subscribed: isFocused,
  });

  return match(location)
    .with({ status: 'needsPermission' }, { status: 'denied' }, () => <WeatherForecastBadge.Empty />)
    .with({ status: 'checking' }, { status: 'unavailable' }, { status: 'ready' }, () => {
      if (badge == null) {
        return isPending ? <WeatherForecastBadge.Loading /> : <WeatherForecastBadge.Empty />;
      }
      return (
        <WeatherForecastBadge.Contents current={badge.current} serviceName={badge.serviceName} />
      );
    })
    .exhaustive();
}

/** 헤더 폭에는 로고(1x 38pt)를 줄이지 않고 넣을 수 없어 날씨 화면으로 보내고 접근성 이름에 공급자를 밝힌다 */
WeatherForecastBadge.Contents = function Contents({
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

WeatherForecastBadge.Loading = function Loading() {
  return (
    <HStack align="center" className="min-h-11 min-w-16 px-1">
      <TextSkeleton size="b4" className="w-8" />
    </HStack>
  );
};

/** 받은 리포트가 없을 때(권한 안내 중·조회 실패) 기온 없이 날씨 화면으로 가는 길만 남긴다 */
WeatherForecastBadge.Empty = function Empty() {
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

function useOpenBadgeWeather() {
  const router = useRouter();
  const push = useSingleTap(router.push);

  return () => push(toWeatherHref({ entry: 'feed_badge', openedAt: toEpochMs(getNowInstant()) }));
}
