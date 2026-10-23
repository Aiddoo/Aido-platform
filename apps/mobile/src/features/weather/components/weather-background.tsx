import { StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { useTimePalette } from '../hooks/use-time-palette';

export function WeatherBackground() {
  const palette = useTimePalette();
  const { width, height } = useWindowDimensions();
  return (
    <Svg
      pointerEvents="none"
      accessible={false}
      width={width}
      height={height}
      style={StyleSheet.absoluteFill}
    >
      <Defs>
        <LinearGradient id="weather-background" x1="0" y1="0" x2="0.3" y2="1">
          <Stop offset="0" stopColor={palette.gradient[0]} />
          <Stop offset="0.5" stopColor={palette.gradient[1]} />
          <Stop offset="1" stopColor={palette.gradient[2]} />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#weather-background)" />
    </Svg>
  );
}
