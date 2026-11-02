import { useGetPreferenceQueryOptions } from '@src/features/preference/queries/get-preference-query-options';
import { useTranslation } from '@src/shared/i18n';
import { Box, HStack, Text, VStack } from '@src/shared/ui';
import { WeatherRainIcon } from '@src/shared/ui/icon';
import { useSuspenseQueries } from '@tanstack/react-query';
import { clamp } from 'es-toolkit';

import { type MinuteForecast, WeatherReportPolicy } from '../domains/weather-report.model';
import { usePrecipitationMessage } from '../hooks/use-precipitation-message';
import {
  useGetWeatherReportQueryOptions,
  WeatherReportSelect,
} from '../queries/get-weather-report-query-options';
import { WeatherCard } from './weather-card';

/** 이 강도(mm/h)에서 막대가 가득 찬다. 시간당 10mm 이상은 같은 높이로 본다. */
const FULL_BAR_INTENSITY = 10;
const CHART_HEIGHT = 48;
const MIN_BAR_HEIGHT = 2;
const CHART_LABEL_MINUTES = [30, 60] as const;

/**
 * 분 단위 예보가 있으면 카드와 그래프로, 없는 지역(국내 등)은 카드 없이 시간 단위 한 줄로 알린다.
 * 6시간 넘게 갱신되지 않은 데이터로는 곧 올 비를 안내하지 않는다.
 */
export function NextHourPrecipitation() {
  const { t } = useTranslation('weather');
  const [{ data, dataUpdatedAt }, { data: preference }] = useSuspenseQueries({
    queries: [
      { ...useGetWeatherReportQueryOptions(), select: WeatherReportSelect.precipitation },
      useGetPreferenceQueryOptions(),
    ],
  });
  const toMessage = usePrecipitationMessage({
    timeZone: data.location.timezone,
    timeFormat: preference.timeFormat,
  });
  const now = new Date(dataUpdatedAt);

  if (WeatherReportPolicy.isNowcastExpired(data, now)) {
    return <NextHourPrecipitation.Empty />;
  }

  const window = WeatherReportPolicy.precipitationWindow(data, now);
  const { headline, detail } = toMessage(window, now);
  const summary = detail == null ? headline : `${headline} · ${detail}`;

  if (data.nextHour == null) {
    return window.kind === 'dry' ? (
      <NextHourPrecipitation.Empty />
    ) : (
      <NextHourPrecipitation.HourlySummary summary={summary} />
    );
  }

  return (
    <WeatherCard
      title={t('nextHour.title')}
      icon={<WeatherRainIcon width={14} height={14} colorClassName="text-white/70" />}
    >
      <VStack gap={2}>
        <Text size="b1" weight="semibold" tone="white">
          {headline}
        </Text>
        {detail != null && (
          <Text size="b3" className="text-white/80">
            {detail}
          </Text>
        )}
      </VStack>
      {data.nextHour.minutes.length > 0 && (
        <NextHourPrecipitation.Chart minutes={data.nextHour.minutes} summary={summary} />
      )}
    </WeatherCard>
  );
}

/** 분 단위 예보가 없는 지역(국내 등)은 카드 대신 시간 단위 한 줄로 알린다. */
NextHourPrecipitation.HourlySummary = function HourlySummary({ summary }: { summary: string }) {
  return (
    <HStack gap={6} align="center" justify="center" accessible accessibilityLabel={summary}>
      <WeatherRainIcon width={16} height={16} colorClassName="text-white" />
      <Text size="b3" weight="medium" tone="white" className="shrink">
        {summary}
      </Text>
    </HStack>
  );
};

NextHourPrecipitation.Chart = function Chart({
  minutes,
  summary,
}: {
  minutes: MinuteForecast[];
  summary: string;
}) {
  const { t } = useTranslation('weather');

  return (
    <VStack
      gap={4}
      accessible
      accessibilityRole="image"
      accessibilityLabel={t('nextHour.chartLabel', { summary })}
    >
      <HStack align="end" gap={1} style={{ height: CHART_HEIGHT }}>
        {minutes.map((minute) => (
          <Box
            key={minute.startsAt.getTime()}
            flex={1}
            className="rounded-full bg-white/80"
            style={{
              height: Math.max(
                MIN_BAR_HEIGHT,
                clamp(minute.precipitationIntensity / FULL_BAR_INTENSITY, 0, 1) * CHART_HEIGHT,
              ),
            }}
          />
        ))}
      </HStack>
      <HStack justify="between">
        <Text size="e2" className="text-white/70">
          {t('nextHour.now')}
        </Text>
        {CHART_LABEL_MINUTES.map((minutesLater) => (
          <Text key={minutesLater} size="e2" className="text-white/70">
            {t('nextHour.minutesLater', { minutes: minutesLater })}
          </Text>
        ))}
      </HStack>
    </VStack>
  );
};

/** 분 단위 예보가 없는 지역이 많아 카드 자리를 미리 잡으면 로딩 뒤 화면이 당겨진다. 자리를 두지 않는다. */
NextHourPrecipitation.Loading = function Loading() {
  return null;
};

NextHourPrecipitation.Empty = function Empty() {
  return null;
};
