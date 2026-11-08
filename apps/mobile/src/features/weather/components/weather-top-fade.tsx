import { Canvas, LinearGradient, Mask, Rect, vec } from '@shopify/react-native-skia';
import { Box } from '@src/shared/ui';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { useUniwind } from 'uniwind';

import { useWeatherScene } from '../hooks/use-weather-scene';
import { ScrimLayer } from './weather-scene/scrim-layer';
import { SkyGradientLayer } from './weather-scene/sky-gradient-layer';

/** 상태 표시줄 아래부터 끝까지 ease-out으로 옅어져 경계선이 생기지 않게 한다. */
const FADE_STOPS = [
  [0, 1],
  [0.35, 0.72],
  [0.65, 0.3],
  [1, 0],
] as const;

interface WeatherTopFadeProps {
  /** 끝까지 불투명하게 덮을 높이(상태 표시줄) */
  solidHeight: number;
  /** 페이드 전체 높이 */
  height: number;
}

/**
 * 스크롤한 내용이 상태 표시줄·투명 헤더 밑으로 지나갈 때 하늘색으로 서서히 덮는다.
 * 배경과 같은 하늘·스크림 레이어를 창 크기로 그리고 위쪽만 남겨 이음매가 보이지 않는다.
 */
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
