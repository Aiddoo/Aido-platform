import { Canvas, LinearGradient, Mask, Rect, vec } from '@shopify/react-native-skia';
import { useRefresh } from '@src/shared/hooks/use-refresh';
import { useResolvedColor } from '@src/shared/hooks/use-resolved-color';
import { IOS_MAJOR_VERSION } from '@src/shared/infra/device/device-info';
import { Box, StyledSafeAreaView } from '@src/shared/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { type PropsWithChildren } from 'react';
import { RefreshControl, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUniwind } from 'uniwind';

import { useWeatherScene } from '../hooks/use-weather-scene';
import { refetchWeather } from '../queries/weather-cache';
import { ScrimLayer } from './weather-scene-canvas/scrim-layer';
import { SkyGradientLayer } from './weather-scene-canvas/sky-gradient-layer';

/** 마지막 카드 아래 여백. 안전 영역과 `bottomInset`에 더한다. */
const SCREEN_BOTTOM_PADDING = 24;
/** 헤더 아래로 페이드가 이어지는 길이 */
const TOP_FADE_EXTENT = 40;
const IS_IOS = process.env.EXPO_OS === 'ios';
/** iOS 26부터는 투명 헤더 아래 내용을 시스템 스크롤 엣지 효과가 흐리므로 직접 그린 페이드를 쓰지 않는다. */
const HAS_NATIVE_EDGE_EFFECT = IOS_MAJOR_VERSION != null && IOS_MAJOR_VERSION >= 26;
/** 상태 표시줄 아래부터 끝까지 ease-out으로 옅어져 경계선이 생기지 않게 한다. */
const FADE_STOPS = [
  [0, 1],
  [0.35, 0.72],
  [0.65, 0.3],
  [1, 0],
] as const;

interface WeatherScrollViewProps extends PropsWithChildren {
  /** 기본 아래 여백에 더할 높이 */
  bottomInset?: number;
}

export function WeatherScrollView({ children, bottomInset = 0 }: WeatherScrollViewProps) {
  const queryClient = useQueryClient();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const [isRefreshing, refresh] = useRefresh(() => refetchWeather(queryClient));
  const refreshTint = useResolvedColor('text-on-sky');

  return (
    <Box flex={1}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: IS_IOS ? 0 : headerHeight,
          // iOS는 contentInsetAdjustmentBehavior가 아래 안전 영역을 이미 더한다
          paddingBottom: (IS_IOS ? 0 : insets.bottom) + SCREEN_BOTTOM_PADDING + bottomInset,
        }}
        refreshControl={
          <RefreshControl
            tintColor={refreshTint}
            progressViewOffset={IS_IOS ? undefined : headerHeight}
            refreshing={isRefreshing}
            onRefresh={refresh}
          />
        }
      >
        <StyledSafeAreaView edges={['left', 'right']} className="flex-1">
          {children}
        </StyledSafeAreaView>
      </ScrollView>
      {!HAS_NATIVE_EDGE_EFFECT && (
        <TopFade solidHeight={insets.top} height={headerHeight + TOP_FADE_EXTENT} />
      )}
    </Box>
  );
}

/** iOS는 헤더 높이만큼 내용이 자동으로 내려가므로 그만큼 아래 여백을 더해 가운데를 맞춘다 */
WeatherScrollView.Status = function Status({ children }: PropsWithChildren) {
  const headerHeight = useHeaderHeight();

  return (
    <WeatherScrollView bottomInset={IS_IOS ? headerHeight : 0}>
      <Box className="flex-1 justify-center px-4">{children}</Box>
    </WeatherScrollView>
  );
};

interface TopFadeProps {
  /** 끝까지 불투명하게 덮을 높이(상태 표시줄) */
  solidHeight: number;
  height: number;
}

/** 배경과 같은 하늘·스크림 레이어를 창 크기로 그리고 위쪽만 남겨 이음매가 보이지 않게 한다 */
function TopFade({ solidHeight, height }: TopFadeProps) {
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
