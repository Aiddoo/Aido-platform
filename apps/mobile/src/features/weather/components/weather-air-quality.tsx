import type { WeatherAirQualitySource } from '@aido/api/vocabulary';
import { useMinimumFontScale } from '@src/shared/hooks/use-minimum-font-scale';
import { useTranslation } from '@src/shared/i18n';
import { Box, HStack, Text, TextSkeleton, VStack } from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { range } from 'es-toolkit';

import { AIR_METER_COLORS } from '../constants/weather-colors.constants';
import {
  type AirPollutant,
  type AirQualityGrade,
  WeatherIndicatorPolicy,
} from '../domains/weather-indicator.model';
import type { AirQuality } from '../domains/weather-report.model';
import { useGetWeatherReportQueryOptions, WeatherReportSelect } from '../queries/weather.queries';
import { toAirMeterPosition } from '../utils/weather-bar.geometry';
import { WeatherCard } from './weather-card';
import { WeatherIcon } from './weather-icon';
import { WeatherMeter } from './weather-meter';

const AIR_GRADE_LABEL_KEYS = {
  good: 'airGrade.good',
  moderate: 'airGrade.moderate',
  bad: 'airGrade.bad',
  veryBad: 'airGrade.veryBad',
} as const satisfies Record<AirQualityGrade, string>;

/** 공공데이터(에어코리아) 이용 조건: 대기질을 보여 주는 곳에 출처를 함께 표기한다. */
const AIR_QUALITY_SOURCE_LABEL_KEYS = {
  AIRKOREA: 'airQualitySource.AIRKOREA',
} as const satisfies Record<WeatherAirQualitySource, string>;

const GRADE_FONT_SIZE = 24;
const POLLUTANT_COUNT = 2;

/** 대기질을 주지 않는 지역(null)은 카드째 숨긴다. 보여 줄 때는 공공데이터 이용 조건대로 출처를 함께 적는다. */
export function WeatherAirQuality() {
  const { t } = useTranslation('weather');
  const { data: airQuality } = useSuspenseQuery({
    ...useGetWeatherReportQueryOptions(),
    select: WeatherReportSelect.airQuality,
  });
  if (airQuality == null) {
    return null;
  }

  return (
    <WeatherCard
      title={t('airQuality.title')}
      icon={<WeatherIcon.Card glyph="air" />}
      className="gap-0 px-4 pt-3.5 pb-4"
    >
      <HStack className="gap-4 mt-1.5">
        <WeatherAirQuality.Pollutant airQuality={airQuality} pollutant="pm10" />
        <WeatherAirQuality.Pollutant airQuality={airQuality} pollutant="pm25" />
      </HStack>
      <Text size="e1" className="mt-3.5 text-on-sky/60">
        {t(AIR_QUALITY_SOURCE_LABEL_KEYS[airQuality.source])}
      </Text>
    </WeatherCard>
  );
}

WeatherAirQuality.Pollutant = function Pollutant({
  airQuality,
  pollutant,
}: {
  airQuality: AirQuality;
  pollutant: AirPollutant;
}) {
  const { t } = useTranslation('weather');
  const labelMinScale = useMinimumFontScale('b4');
  const gradeMinScale = useMinimumFontScale(GRADE_FONT_SIZE);
  const value = airQuality[pollutant];
  const grade = WeatherIndicatorPolicy.getPollutantGrade(airQuality, pollutant);
  const label = t(`airQuality.${pollutant}`);
  const gradeLabel = grade == null ? t('details.noValue') : t(AIR_GRADE_LABEL_KEYS[grade]);
  const valueLabel = value == null ? t('details.noValue') : t('airQuality.value', { value });

  return (
    <VStack
      className="min-w-0 flex-1"
      accessible
      accessibilityLabel={t('airQuality.item', { label, grade: gradeLabel, value: valueLabel })}
    >
      <Text
        size="b4"
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={labelMinScale}
        className="leading-[18px] text-on-sky/70"
      >
        {label}
      </Text>
      <Text
        tone="onSky"
        numberOfLines={1}
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
          position={value == null ? null : toAirMeterPosition(value, pollutant)}
        />
      </Box>
    </VStack>
  );
};

/** 받은 뒤와 같은 자리를 잡는다. 이름, 등급, 값, 막대가 두 칸이고 아래에 출처 줄이 있다. */
WeatherAirQuality.Loading = function Loading() {
  return (
    <WeatherCard className="gap-0 px-4 pt-3.5 pb-4">
      <TextSkeleton size="b4" className="w-16 opacity-40" />
      <HStack className="gap-4 mt-1.5">
        {range(POLLUTANT_COUNT).map((index) => (
          <VStack key={index} className="min-w-0 flex-1">
            <TextSkeleton size="b4" className="w-1/2 opacity-40" />
            <TextSkeleton size="t2" className="w-3/4 opacity-40" />
            <TextSkeleton size="b4" className="w-2/3 opacity-40" />
            <Box className="mt-3 h-[5px] rounded-full bg-on-sky/[0.12]" />
          </VStack>
        ))}
      </HStack>
      <TextSkeleton size="e1" className="mt-3.5 w-28 opacity-40" />
    </WeatherCard>
  );
};
