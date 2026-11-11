import { Canvas, Group } from '@shopify/react-native-skia';
import { SECOND_MS } from '@src/shared/constants/time-units';
import { useLayoutSize } from '@src/shared/hooks/use-layout-size';
import { DEVICE_TOTAL_MEMORY_BYTES } from '@src/shared/infra/device/device-info';
import { Box } from '@src/shared/ui';
import { isEqual } from 'es-toolkit';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import {
  cancelAnimation,
  Easing,
  type FrameInfo,
  type SharedValue,
  useFrameCallback,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { match } from 'ts-pattern';
import { useUniwind } from 'uniwind';

import { useIsWeatherSceneRunning } from '../../hooks/use-is-weather-scene-running';
import { getCelestialCenter } from '../../utils/weather-scene-particles';
import type { WeatherScene } from '../../utils/weather-scene.view-model';
import { type CloudLight, CloudLayer } from './cloud-layer';
import { FogBandLayer } from './fog-band-layer';
import { FogLayer } from './fog-layer';
import { FrostLayer } from './frost-layer';
import { GlassDropletLayer } from './glass-droplet-layer';
import { GustLayer } from './gust-layer';
import { HailLayer } from './hail-layer';
import { HazeLayer } from './haze-layer';
import { HeatLayer } from './heat-layer';
import { IcePelletLayer } from './ice-pellet-layer';
import { LightningLayer } from './lightning-layer';
import { NightSkyLayer } from './night-sky-layer';
import { RainLayer } from './rain-layer';
import { BelowHeader, HeroScrimLayer, ScrimLayer } from './scrim-layer';
import { SkyGradientLayer } from './sky-gradient-layer';
import { SnowLayer } from './snow-layer';
import { SunLayer } from './sun-layer';

const LOW_END_MEMORY_BYTES = 3 * 1024 ** 3;
const IS_LOW_END_DEVICE =
  DEVICE_TOTAL_MEMORY_BYTES != null && DEVICE_TOTAL_MEMORY_BYTES < LOW_END_MEMORY_BYTES;
const STATIC_SCENE_SECONDS = 12;
const MAX_FRAME_STEP_MS = 100;
const SCENE_FADE = { duration: 900, easing: Easing.inOut(Easing.quad) };
/** 진눈깨비는 빗줄기를 비보다 조금 성기게 내린다. */
const SLEET_RAIN_SHARE = 0.67;
const SUN_LIGHT_RGB = '255,236,205';
const MOON_LIGHT_RGB = '215,225,250';

type SceneEntry = { id: number; scene: WeatherScene };

type SceneSize = { width: number; height: number };

/** 사라지는 도중 또 바뀌면 사라지던 장면은 끊는다. 드문 일이라 장면을 쌓지 않는다 */
function useSceneCrossFade(scene: WeatherScene) {
  const [current, setCurrent] = useState<SceneEntry>({ id: 0, scene });
  const [outgoing, setOutgoing] = useState<SceneEntry | null>(null);
  if (!isEqual(current.scene, scene)) {
    setOutgoing(current);
    setCurrent({ id: current.id + 1, scene });
  }
  const finishFade = useCallback((id: number) => {
    setOutgoing((previous) => (previous?.id === id ? null : previous));
  }, []);
  return { entries: outgoing == null ? [current] : [outgoing, current], current, finishFade };
}

type WeatherSceneCanvasProps = {
  scene: WeatherScene;
  /** 투명 헤더 아래 내용이 시작하는 높이. 해·달을 헤더 버튼 아래에 둔다. */
  contentTop: number;
  /** 지명·기온이 놓인 단의 시작과 폭. 넓은 화면에서는 왼쪽 단, 옆 레일이 있으면 레일을 뺀 영역이다. */
  heroLeft: number;
  heroWidth: number;
};

export function WeatherSceneCanvas({
  scene,
  contentTop,
  heroLeft,
  heroWidth,
}: WeatherSceneCanvasProps) {
  const window = useWindowDimensions();
  const [layoutSize, handleLayout] = useLayoutSize();
  const { width, height } = layoutSize.width === 0 ? window : layoutSize;
  const { theme } = useUniwind();
  const isAnimating = useIsWeatherSceneRunning();
  const time = useSharedValue(STATIC_SCENE_SECONDS);
  const advanceTime = useCallback(
    (frame: FrameInfo) => {
      'worklet';
      const step = Math.min(frame.timeSincePreviousFrame ?? 0, MAX_FRAME_STEP_MS);
      time.set(time.get() + step / SECOND_MS);
    },
    [time],
  );
  const frameClock = useFrameCallback(advanceTime, false);
  const { entries, current, finishFade } = useSceneCrossFade(scene);

  useEffect(() => {
    frameClock.setActive(isAnimating);
    return () => frameClock.setActive(false);
  }, [frameClock, isAnimating]);

  // Skia Canvas는 onLayout을 받지 않아 감싼 View에서 크기를 잰다.
  return (
    <Box
      style={StyleSheet.absoluteFill}
      onLayout={handleLayout}
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <Canvas style={StyleSheet.absoluteFill} opaque highBitDepth={!IS_LOW_END_DEVICE}>
        <SkyGradientLayer
          sky={current.scene.sky}
          isDark={theme === 'dark'}
          width={width}
          height={height}
        />
        {entries.map((entry) => (
          <SceneLayers
            key={entry.id}
            entry={entry}
            isLeaving={entry !== current}
            isFirst={entry.id === 0}
            isAnimating={isAnimating}
            isDark={theme === 'dark'}
            contentTop={contentTop}
            heroLeft={heroLeft}
            heroWidth={heroWidth}
            size={{ width, height }}
            time={time}
            onFaded={finishFade}
          />
        ))}
        <HeroScrimLayer
          isDaylight={current.scene.isDaylight}
          contentTop={contentTop}
          heroLeft={heroLeft}
          heroWidth={heroWidth}
          width={width}
          height={height}
        />
        <ScrimLayer isDaylight={current.scene.isDaylight} width={width} height={height} />
      </Canvas>
    </Box>
  );
}

/** 해·달이 떠 있으면 그 자리와 빛 색을 구름에 알려 가장자리가 빛나고 가린 정도를 잴 수 있게 한다. */
function findCloudLight(
  scene: WeatherScene,
  position: { x: number; y: number },
): CloudLight | null {
  if (scene.sun !== 'hidden') {
    return { ...position, rgb: SUN_LIGHT_RGB };
  }
  return scene.hasMoon ? { ...position, rgb: MOON_LIGHT_RGB } : null;
}

type SceneLayersProps = {
  entry: SceneEntry;
  isDark: boolean;
  contentTop: number;
  heroLeft: number;
  heroWidth: number;
  isLeaving: boolean;
  isFirst: boolean;
  isAnimating: boolean;
  size: SceneSize;
  time: SharedValue<number>;
  onFaded: (id: number) => void;
};

function SceneLayers({
  entry,
  isDark,
  contentTop,
  heroLeft,
  heroWidth,
  isLeaving,
  isFirst,
  isAnimating,
  size,
  time,
  onFaded,
}: SceneLayersProps) {
  const { id, scene } = entry;
  const opacity = useSharedValue(isFirst ? 1 : 0);
  const occlusion = useSharedValue(0);
  const celestialCenter = getCelestialCenter(size, { contentTop, heroLeft, heroWidth });

  useEffect(() => {
    opacity.set(
      isLeaving
        ? withTiming(0, SCENE_FADE, (isFinished) => {
            if (isFinished) {
              scheduleOnRN(onFaded, id);
            }
          })
        : withTiming(1, SCENE_FADE),
    );
    return () => cancelAnimation(opacity);
  }, [id, isLeaving, onFaded, opacity]);

  const { precipitation } = scene;
  const area = { ...size, time };
  const particles = { ...area, isLowEndDevice: IS_LOW_END_DEVICE };
  const fall = {
    ...particles,
    isDaylight: scene.isDaylight,
    speed: precipitation.speed,
    angle: precipitation.angle,
  };

  return (
    <Group opacity={opacity}>
      <BelowHeader contentTop={contentTop} width={size.width} height={size.height}>
        {scene.sun !== 'hidden' && (
          <SunLayer
            {...area}
            sun={scene.sun}
            center={celestialCenter}
            hasLensFlare={scene.hasLensFlare}
            clouds={scene.clouds}
            isDark={isDark}
            occlusion={occlusion}
          />
        )}
        <NightSkyLayer
          {...area}
          hasMoon={scene.hasMoon}
          celestialCenter={celestialCenter}
          moonPhase={scene.moonPhase}
          isDark={isDark}
          occlusion={occlusion}
          isSouthernHemisphere={scene.isSouthernHemisphere}
          hasStars={scene.hasStars}
          hasShootingStars={scene.hasShootingStars && isAnimating}
          clouds={scene.clouds}
        />
      </BelowHeader>
      <CloudLayer
        {...area}
        amount={scene.clouds}
        wind={scene.wind}
        sky={scene.sky}
        isDaylight={scene.isDaylight}
        light={findCloudLight(scene, celestialCenter)}
        occlusion={occlusion}
      />
      {match(scene.atmosphere)
        .with('fogBands', () => <FogBandLayer {...area} sky={scene.sky} />)
        .with('haze', () => <HazeLayer {...particles} />)
        .with('gusts', () => <GustLayer {...particles} />)
        .with('calm', 'mistyGlass', 'heat', 'frost', () => null)
        .exhaustive()}
      {match(precipitation.kind)
        .with('none', () => null)
        .with('drizzle', 'rain', (variant) => (
          <RainLayer {...fall} variant={variant} density={precipitation.density} />
        ))
        .with('sleet', () => (
          <>
            <RainLayer
              {...fall}
              variant="rain"
              density={precipitation.density * SLEET_RAIN_SHARE}
            />
            <IcePelletLayer {...particles} density={precipitation.density} />
          </>
        ))
        .with('hail', () => (
          <HailLayer {...particles} density={precipitation.density} wind={scene.wind} />
        ))
        .with('snow', () => (
          <SnowLayer {...fall} density={precipitation.density} wind={scene.wind} />
        ))
        .exhaustive()}
      {scene.fog > 0 && <FogLayer {...area} amount={scene.fog} sky={scene.sky} />}
      {match(scene.atmosphere)
        .with('mistyGlass', () => <GlassDropletLayer {...particles} />)
        .with('frost', () => <FrostLayer {...particles} />)
        .with('heat', () => <HeatLayer {...particles} />)
        .with('calm', 'fogBands', 'haze', 'gusts', () => null)
        .exhaustive()}
      {scene.hasLightning && isAnimating && <LightningLayer {...area} />}
    </Group>
  );
}
