import { useTranslation } from '@src/shared/i18n';
import { HStack, Text, VStack } from '@src/shared/ui';
import { WeatherSunriseIcon, WeatherSunsetIcon } from '@src/shared/ui/icon';
import { useSuspenseQuery } from '@tanstack/react-query';

import { useTimePalette } from '../hooks/use-time-palette';
import { useGetConditionsQueryOptions } from '../queries/get-conditions-query-options';
import { WeatherCard } from './weather-card';

export function SunriseSunset() {
  const { t } = useTranslation('weather');
  const { data: conditions } = useSuspenseQuery(useGetConditionsQueryOptions());

  if (conditions.sunrise == null && conditions.sunset == null) {
    return null;
  }

  return (
    <WeatherCard>
      <HStack gap={20} className="justify-center">
        {conditions.sunrise != null && (
          <SunTime
            icon={WeatherSunriseIcon}
            label={t('screen.sunrise')}
            time={conditions.sunrise}
          />
        )}
        {conditions.sunset != null && (
          <SunTime icon={WeatherSunsetIcon} label={t('screen.sunset')} time={conditions.sunset} />
        )}
      </HStack>
    </WeatherCard>
  );
}

function SunTime({
  icon: Icon,
  label,
  time,
}: {
  icon: typeof WeatherSunriseIcon;
  label: string;
  time: string;
}) {
  const palette = useTimePalette();

  return (
    <VStack align="center" gap={4}>
      <HStack align="center" gap={4}>
        <Icon width={18} height={18} color={palette.textSub} />
        <Text size="b4" style={{ color: palette.textSub }}>
          {label}
        </Text>
      </HStack>
      <Text size="b1" weight="semibold" style={{ color: palette.text }}>
        {time}
      </Text>
    </VStack>
  );
}
