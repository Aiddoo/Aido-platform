import { useTranslation } from '@src/shared/i18n';
import { Box, Spacing, Text, VStack } from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';

import { useTimePalette } from '../hooks/use-time-palette';
import { useGetConditionsQueryOptions } from '../queries/get-conditions-query-options';

export function FeelsLikeTemperature() {
  const palette = useTimePalette();
  const { t } = useTranslation('weather');
  const { data: conditions } = useSuspenseQuery(useGetConditionsQueryOptions());

  if (conditions.feelsLikeTemperature == null) {
    return null;
  }

  return (
    <VStack align="center">
      <Box px={16} py={8} className="rounded-[20px]" style={{ backgroundColor: palette.glass }}>
        <Text size="b4" weight="medium" style={{ color: palette.text }}>
          {t('screen.feelsLike', { temp: Math.round(conditions.feelsLikeTemperature) })}
        </Text>
      </Box>
      <Spacing size={32} />
    </VStack>
  );
}
