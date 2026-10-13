import { useTranslation } from '@src/shared/i18n';
import { HStack, Text, VStack } from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';

import { type DustGrade, WeatherPolicy } from '../domains/weather.model';
import { useTimePalette } from '../hooks/use-time-palette';
import { useGetConditionsQueryOptions } from '../queries/get-conditions-query-options';
import { WeatherCard } from './weather-card';

const DUST_GRADE_LABEL_KEYS = {
  good: 'dust.good',
  normal: 'dust.normal',
  bad: 'dust.bad',
  veryBad: 'dust.veryBad',
} as const satisfies Record<DustGrade, string>;

export function AirQuality() {
  const { t } = useTranslation('weather');
  const { data: conditions } = useSuspenseQuery(useGetConditionsQueryOptions());
  const pm10Grade = WeatherPolicy.pm10Grade(conditions);
  const pm25Grade = WeatherPolicy.pm25Grade(conditions);

  if (pm10Grade == null && pm25Grade == null) {
    return null;
  }

  return (
    <WeatherCard>
      <HStack gap={20} className="justify-center">
        {pm10Grade != null && <DustRecord label={t('screen.pm10')} grade={pm10Grade} />}
        {pm25Grade != null && <DustRecord label={t('screen.pm25')} grade={pm25Grade} />}
      </HStack>
    </WeatherCard>
  );
}

function DustRecord({ label, grade }: { label: string; grade: DustGrade }) {
  const palette = useTimePalette();
  const { t } = useTranslation('weather');

  return (
    <VStack align="center" gap={4}>
      <Text size="b4" style={{ color: palette.textSub }}>
        {label}
      </Text>
      <Text size="b1" weight="semibold" style={{ color: palette.text }}>
        {t(DUST_GRADE_LABEL_KEYS[grade])}
      </Text>
    </VStack>
  );
}
