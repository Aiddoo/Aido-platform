import type { WeatherCondition } from '@aido/api/vocabulary';
import { Box, Image } from '@src/shared/ui';
import type { ImageSource } from 'expo-image';
import { type ComponentProps, useState } from 'react';

import { WeatherIcon } from './weather-icon';

const FALLBACK_ICON_SIZE = 40;

interface WeatherMascotProps extends Omit<
  ComponentProps<typeof Image>,
  'source' | 'onError' | 'accessible'
> {
  source: ImageSource | number;
  /** 이미지를 불러오지 못했을 때 대신 그릴 날씨 아이콘 */
  fallbackCondition: WeatherCondition;
}

/** 고양이 이미지는 장식이다. 불러오지 못하면 같은 자리에 날씨 아이콘을 그려 빈칸을 남기지 않는다. */
export function WeatherMascot({
  source,
  fallbackCondition,
  className,
  ...props
}: WeatherMascotProps) {
  const [hasFailed, setHasFailed] = useState(false);

  if (hasFailed) {
    return (
      <Box className={className} accessible={false} importantForAccessibility="no">
        <Box className="flex-1 items-center justify-center">
          <WeatherIcon
            condition={fallbackCondition}
            isDaylight
            width={FALLBACK_ICON_SIZE}
            height={FALLBACK_ICON_SIZE}
          />
        </Box>
      </Box>
    );
  }
  return (
    <Image
      source={source}
      className={className}
      contentFit="contain"
      accessible={false}
      accessibilityIgnoresInvertColors
      onError={() => setHasFailed(true)}
      {...props}
    />
  );
}
