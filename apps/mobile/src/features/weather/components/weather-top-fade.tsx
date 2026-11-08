import { Canvas, LinearGradient, Mask, Rect, vec } from '@shopify/react-native-skia';
import { Box } from '@src/shared/ui';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { useUniwind } from 'uniwind';

import { useWeatherScene } from '../hooks/use-weather-scene';
import { ScrimLayer } from './weather-scene/scrim-layer';
import { SkyGradientLayer } from './weather-scene/sky-gradient-layer';

const FADE_STOPS = [
  [0, 1],
  [0.35, 0.72],
  [0.65, 0.3],
  [1, 0],
] as const;

interface WeatherTopFadeProps {
  solidHeight: number;
  height: number;
}

/** 스크롤한 내용이 상태 표시줄·투명 헤더 밑으로 지나갈 때 하늘색으로 서서히 덮는다 */
export function WeatherTopFade({ solidHeight, height }: WeatherTopFadeProps) {
  const scene = useWeatherScene();
  const window = useWindowDimensions();
  const { theme } = useUniwind();

  return (
    <Box pointerEvents="none" className="absolute inset-x-0 top-0" style={{ height }}>
      <Canvas
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
        accessible={false}
        importantForAccessibility="no-hide-descendants"
      >
        <Mask
          mask={
            <Rect x={0} y={0} width={window.width} height={height}>
              <LinearGradient
                start={vec(0, 0)}
                end={vec(0, height)}
                colors={[
                  'rgba(255,255,255,1)',
                  ...FADE_STOPS.map(([, alpha]) => `rgba(255,255,255,${alpha})`),
                ]}
                positions={[
                  0,
                  ...FADE_STOPS.map(
                    ([offset]) => (solidHeight + (height - solidHeight) * offset) / height,
                  ),
                ]}
              />
            </Rect>
          }
        >
          <SkyGradientLayer
            sky={scene.sky}
            isDark={theme === 'dark'}
            width={window.width}
            height={window.height}
          />
          <ScrimLayer isDaylight={scene.isDaylight} width={window.width} height={window.height} />
        </Mask>
      </Canvas>
    </Box>
  );
}
