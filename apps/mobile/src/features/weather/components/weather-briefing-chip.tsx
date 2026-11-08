import type { WeatherCondition } from '@aido/api/vocabulary';
import { useFontScaleRatio } from '@src/shared/hooks/use-font-scale-ratio';
import { Text } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { Chip } from 'heroui-native';
import type { ComponentProps } from 'react';

import { BRIEFING_ROW_TONES, type BriefingRowTone } from '../constants/weather-colors.constants';
import { WeatherIcon } from './weather-icon';

const CHIP_ICON_SIZE = 15;

interface WeatherBriefingChipProps extends Omit<
  ComponentProps<typeof Chip>,
  'variant' | 'size' | 'color' | 'children'
> {
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
  className,
  ...props
}: WeatherBriefingChipProps) {
  const iconSize = Math.round(CHIP_ICON_SIZE * useFontScaleRatio());
  return (
    <Chip
      variant="tertiary"
      className={cn(
        'min-h-[26px] gap-[3px] self-start rounded-[13px] py-0 pr-[9px] pl-[7px]',
        BRIEFING_ROW_TONES[tone].chip,
        className,
      )}
      {...props}
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
    </Chip>
  );
}
