import type { WeatherCondition } from '@aido/api';
import { useFontScaleRatio } from '@src/shared/hooks/use-minimum-font-scale';
import { HStack, Text } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';

import { BRIEFING_ROW_TONES, type BriefingRowTone } from '../constants/weather-colors';
import { WeatherIcon } from './weather-icon';

const CHIP_ICON_SIZE = 15;

interface WeatherBriefingChipProps {
  condition: WeatherCondition;
  isDaylight: boolean;
  label: string;
  tone: BriefingRowTone;
}

/** 할 일 시각의 날씨를 아이콘과 강수 확률·기온 한 값으로 줄여 보여 준다. */
export function WeatherBriefingChip({
  condition,
  isDaylight,
  label,
  tone,
}: WeatherBriefingChipProps) {
  const iconSize = Math.round(CHIP_ICON_SIZE * useFontScaleRatio());
  return (
    <HStack
      align="center"
      gap={3}
      className={cn(
        'min-h-[26px] self-start rounded-[13px] pr-[9px] pl-[7px]',
        BRIEFING_ROW_TONES[tone].chip,
      )}
    >
      <WeatherIcon
        condition={condition}
        isDaylight={isDaylight}
        width={iconSize}
        height={iconSize}
      />
      <Text size="e1" weight="semibold" tone="onSky" className="tabular-nums">
        {label}
      </Text>
    </HStack>
  );
}
