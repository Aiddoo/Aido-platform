import { useTranslation } from '@src/shared/i18n';
import { Box, Text } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import type { StyleProp, ViewStyle } from 'react-native';

import { useWeatherDevOverride } from '../queries/weather.queries';
import { getWeatherConditionLabelKey } from '../utils/weather-labels.view-model';

interface DevOverrideBadgeProps {
  /** 화면이 띄울 자리 */
  className?: string;
  style?: StyleProp<ViewStyle>;
}

/** 개발 QA로 지금 날씨를 바꿔 보는 중임을 알려 실제 데이터로 착각하지 않게 한다. */
export function DevOverrideBadge({ className, style }: DevOverrideBadgeProps) {
  const [override] = useWeatherDevOverride();
  const { t } = useTranslation('weather');
  if (override == null) {
    return null;
  }
  return (
    <Box
      pointerEvents="none"
      className={cn('rounded-full bg-black/60 px-3 py-1', className)}
      style={style}
    >
      <Text size="b4" weight="medium" tone="onSky">
        {`DEV · ${t(getWeatherConditionLabelKey(override.condition))} · ${override.isDaylight ? 'day' : 'night'}`}
      </Text>
    </Box>
  );
}
