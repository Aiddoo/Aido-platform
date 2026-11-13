import { useTranslation } from '@src/shared/i18n';
import { Box, Text } from '@src/shared/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDevWeatherOverride } from '../hooks/use-dev-weather-override';
import { getWeatherConditionLabelKey } from '../utils/weather-labels.view-model';

const DEV_BADGE_BOTTOM = 8;

/** 개발 QA로 지금 날씨를 바꿔 보는 중임을 알려 실제 데이터로 착각하지 않게 한다. */
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
        {`DEV · ${t(getWeatherConditionLabelKey(override.condition))} · ${override.isDaylight ? 'day' : 'night'}`}
      </Text>
    </Box>
  );
}
