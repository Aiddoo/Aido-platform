import { Box } from '@src/shared/ui';
import { useId } from 'react';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { useWeatherSurface } from '../hooks/use-weather-surface';

const METER_HEIGHT = 5;
const DOT_SIZE = 10;
const RING_WIDTH = 2.5;
const RING_SIZE = DOT_SIZE + RING_WIDTH * 2;

interface WeatherMeterProps {
  colors: readonly string[];
  /** 0~1 사이 현재 값 자리. 값이 없으면 점을 그리지 않는다. */
  position: number | null;
}

/** 등급 그라데이션 막대 위에 지금 값을 흰 점으로 찍는다. 점 테두리는 카드 색조를 따른다. */
export function WeatherMeter({ colors, position }: WeatherMeterProps) {
  const { nowRing } = useWeatherSurface();
  const gradientId = useId();
  const lastIndex = Math.max(colors.length - 1, 1);

  return (
    <Box className="relative" style={{ height: METER_HEIGHT }} accessible={false}>
      <Svg width="100%" height={METER_HEIGHT}>
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
            {colors.map((color, index) => (
              <Stop key={color} offset={index / lastIndex} stopColor={color} />
            ))}
          </LinearGradient>
        </Defs>
        <Rect
          width="100%"
          height={METER_HEIGHT}
          rx={METER_HEIGHT / 2}
          fill={`url(#${gradientId})`}
        />
      </Svg>
      {position != null && (
        <Box
          className="absolute items-center justify-center rounded-full"
          style={{
            left: `${position * 100}%`,
            top: (METER_HEIGHT - RING_SIZE) / 2,
            width: RING_SIZE,
            height: RING_SIZE,
            marginLeft: -RING_SIZE / 2,
            backgroundColor: nowRing,
          }}
        >
          <Box className="rounded-full bg-on-sky" style={{ width: DOT_SIZE, height: DOT_SIZE }} />
        </Box>
      )}
    </Box>
  );
}
