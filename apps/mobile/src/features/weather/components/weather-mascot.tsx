import type { WeatherCondition } from '@aido/api';
import { Box } from '@src/shared/ui';
import { Image, type ImageSource } from 'expo-image';
import { type ComponentProps, useState } from 'react';
import { withUniwind } from 'uniwind';

import { WeatherIcon } from './weather-icon';

const StyledImage = withUniwind(Image);
const FALLBACK_ICON_SIZE = 40;

interface WeatherMascotProps extends Omit<
  ComponentProps<typeof StyledImage>,
  'source' | 'onError' | 'accessible'
> {
  source: ImageSource | number;
  /** 이미지를 불러오지 못했을 때 대신 그릴 날씨 아이콘 */
  fallbackCondition: WeatherCondition;
  /** 대체 아이콘 색. 하늘 장면 위는 흰색, 테마 표면 위는 회색 */
  fallbackColorClassName?: string;
}

/** 고양이 이미지는 장식이다. 불러오지 못하면 같은 자리에 날씨 아이콘을 그려 빈칸을 남기지 않는다. */
export function WeatherMascot({
  source,
  fallbackCondition,
  fallbackColorClassName,
  className,
  ...props
}: WeatherMascotProps) {
  const [hasFailed, setHasFailed] = useState(false);

  if (hasFailed) {
    return (
      <Box
        className={className}
        accessible={false}
        importantForAccessibility="no"
        testID="weather-mascot-fallback"
      >
        <Box className="flex-1 items-center justify-center">
          <WeatherIcon
            condition={fallbackCondition}
            isDaylight
            width={FALLBACK_ICON_SIZE}
            height={FALLBACK_ICON_SIZE}
            colorClassName={fallbackColorClassName}
          />
        </Box>
      </Box>
    );
  }
  return (
    <StyledImage
      source={source}
      className={className}
      contentFit="contain"
      accessible={false}
      accessibilityIgnoresInvertColors
      onError={() => setHasFailed(true)}
      testID="weather-mascot"
      {...props}
    />
  );
}
