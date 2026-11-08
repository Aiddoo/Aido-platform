import { useTranslation } from '@src/shared/i18n';
import { Box, Text } from '@src/shared/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { WEATHER_CONDITION_LABEL_KEYS } from '../constants/weather-labels';
import { useDevWeatherOverride } from '../hooks/use-dev-weather-override';

const DEV_BADGE_BOTTOM = 8;

export function DevOverrideBadge() {
  const [override] = useDevWeatherOverride();
  const { t } = useTranslation('weather');
  const insets = useSafeAreaInsets();
  if (override == null) {
    return null;
  }
  return (
    <Box
      pointerEvents="none"
      className="absolute self-center rounded-full bg-black/60 px-3 py-1"
      style={{ bottom: insets.bottom + DEV_BADGE_BOTTOM }}
    >
      <Text size="b4" weight="medium" tone="onSky">
        {`DEV · ${t(WEATHER_CONDITION_LABEL_KEYS[override.condition])} · ${override.isDaylight ? 'day' : 'night'}`}
      </Text>
    </Box>
  );
}
