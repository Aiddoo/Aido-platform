import type { WeatherCondition } from '@aido/api';
import {
  MoonIcon,
  WeatherClearIcon,
  WeatherCloudyIcon,
  WeatherPartlyCloudyIcon,
  WeatherRainIcon,
  WeatherShowerIcon,
  WeatherSnowIcon,
} from '@src/shared/ui/icon';
import type { ComponentProps } from 'react';
import { match } from 'ts-pattern';

interface WeatherIconProps extends Omit<ComponentProps<typeof WeatherClearIcon>, 'color'> {
  condition: WeatherCondition;
  isDaylight: boolean;
}

/**
 * 상태 이름은 옆의 글자가 읽어 주므로 아이콘은 보조 기술에서 숨긴다.
 * 해는 늘 노란색이고, 나머지는 놓인 바탕에 맞춰 colorClassName(기본 흰색)을 쓴다.
 */
export function WeatherIcon({
  condition,
  isDaylight,
  width = 24,
  height = 24,
  colorClassName = 'text-white',
  ...props
}: WeatherIconProps) {
  const { Icon, colorClassName: resolvedColor } = match(condition)
    .with('CLEAR', 'MOSTLY_CLEAR', 'HOT', () =>
      isDaylight
        ? { Icon: WeatherClearIcon, colorClassName: 'text-warning' }
        : { Icon: MoonIcon, colorClassName },
    )
    .with('PARTLY_CLOUDY', 'MOSTLY_CLOUDY', () => ({
      Icon: WeatherPartlyCloudyIcon,
      colorClassName,
    }))
    .with('CLOUDY', 'FOGGY', 'HAZY', 'WINDY', 'FRIGID', () => ({
      Icon: WeatherCloudyIcon,
      colorClassName,
    }))
    .with('DRIZZLE', 'RAIN', 'HEAVY_RAIN', () => ({
      Icon: WeatherRainIcon,
      colorClassName,
    }))
    .with('THUNDERSTORMS', () => ({ Icon: WeatherShowerIcon, colorClassName }))
    .with('SLEET', 'SNOW', 'HEAVY_SNOW', 'HAIL', () => ({
      Icon: WeatherSnowIcon,
      colorClassName,
    }))
    .exhaustive();

  return (
    <Icon
      width={width}
      height={height}
      colorClassName={resolvedColor}
      accessible={false}
      importantForAccessibility="no"
      {...props}
    />
  );
}
