import { useMinimumFontScale } from '@src/shared/hooks/use-minimum-font-scale';
import { useTranslation } from '@src/shared/i18n';
import { Box, HStack, Text, TextSkeleton, VStack } from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';

import { AIR_METER_COLORS } from '../constants/weather-colors';
import { AIR_GRADE_LABEL_KEYS, AIR_QUALITY_SOURCE_LABEL_KEYS } from '../constants/weather-labels';
import { type AirPollutant, WeatherDetailPolicy } from '../domains/weather-detail.model';
import { WeatherReportPolicy } from '../domains/weather-report.model';
import {
  useGetWeatherReportQueryOptions,
  WeatherReportSelect,
} from '../queries/get-weather-report-query-options';
import { WeatherCard } from './weather-card';
import { WeatherIcon } from './weather-icon';
import { WeatherMeter } from './weather-meter';

const GRADE_FONT_SIZE = 24;
const POLLUTANTS = ['pm10', 'pm25'] as const satisfies readonly AirPollutant[];

/** 대기질을 주지 않는 지역(null)은 카드째 숨긴다. 보여 줄 때는 공공데이터 이용 조건대로 출처를 함께 적는다. */
export function WeatherAirQuality() {
  const { t } = useTranslation('weather');
  const { data: airQuality } = useSuspenseQuery({
    ...useGetWeatherReportQueryOptions(),
    select: WeatherReportSelect.airQuality,
  });
  const labelMinScale = useMinimumFontScale('b4');
  const gradeMinScale = useMinimumFontScale(GRADE_FONT_SIZE);
  if (airQuality == null) {
    return null;
  }

  return (
    <WeatherCard
      title={t('airQuality.title')}
      icon={<WeatherIcon.Card glyph="air" />}
      className="gap-0 px-4 pt-3.5 pb-4"
    >
      <HStack gap={16} className="mt-1.5">
        {POLLUTANTS.map((pollutant) => {
          const value = airQuality[pollutant];
          const grade = WeatherReportPolicy.airQualityGrade(
            WeatherDetailPolicy.pickPollutant(airQuality, pollutant),
          );
          const label = t(`airQuality.${pollutant}`);
          const gradeLabel = grade == null ? t('details.noValue') : t(AIR_GRADE_LABEL_KEYS[grade]);
          const valueLabel =
            value == null ? t('details.noValue') : t('airQuality.value', { value });

          return (
            <VStack
              key={pollutant}
              className="min-w-0 flex-1"
              accessible
              accessibilityLabel={t('airQuality.item', {
                label,
                grade: gradeLabel,
                value: valueLabel,
              })}
            >
              <Text
                size="b4"
                maxLines={1}
                adjustsFontSizeToFit
                minimumFontScale={labelMinScale}
                className="leading-[18px] text-on-sky/70"
              >
                {label}
              </Text>
              <Text
                tone="onSky"
                maxLines={1}
                adjustsFontSizeToFit
                minimumFontScale={gradeMinScale}
                className="text-[24px] leading-[32px] font-medium tracking-[-0.6px]"
              >
                {gradeLabel}
              </Text>
              <Text size="b4" className="leading-[18px] text-on-sky/70 tabular-nums">
                {valueLabel}
              </Text>
              <Box className="mt-3">
                <WeatherMeter
                  colors={AIR_METER_COLORS}
                  position={
                    value == null ? null : WeatherDetailPolicy.airMeterPosition(value, pollutant)
                  }
                />
              </Box>
            </VStack>
          );
        })}
      </HStack>
      <Text size="e1" className="mt-3.5 text-on-sky/60">
        {t(AIR_QUALITY_SOURCE_LABEL_KEYS[airQuality.source])}
      </Text>
    </WeatherCard>
  );
}

WeatherAirQuality.Loading = function Loading() {
  return (
    <WeatherCard className="gap-2 px-4 pt-3.5 pb-4">
      <TextSkeleton size="b4" className="w-16 opacity-40" />
      <HStack gap={16}>
        <TextSkeleton size="t2" className="flex-1 opacity-40" />
        <TextSkeleton size="t2" className="flex-1 opacity-40" />
      </HStack>
    </WeatherCard>
  );
};
