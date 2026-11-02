import { Canvas, Group, type SkImage } from '@shopify/react-native-skia';
import { isEqual } from 'es-toolkit';
import * as Device from 'expo-device';
import { useCallback, useEffect, useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, useWindowDimensions, View } from 'react-native';
import {
  cancelAnimation,
  Easing,
  type SharedValue,
  useFrameCallback,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { match } from 'ts-pattern';
import { useUniwind } from 'uniwind';

import type { WeatherScene } from '../../domains/weather-scene.model';
import { useWeatherSceneClock } from '../../hooks/use-weather-scene-clock';
import { CloudLayer } from './cloud-layer';
import { FogLayer } from './fog-layer';
import { LightningLayer } from './lightning-layer';
import { RainLayer } from './rain-layer';
import { ScrimLayer } from './scrim-layer';
import { SkyGradientLayer } from './sky-gradient-layer';
import { SnowLayer } from './snow-layer';
import { StarLayer } from './star-layer';
import { SunGlowLayer } from './sun-glow-layer';
import { useCloudTexture, useParticleTexture, useSunRaysTexture } from './weather-scene-textures';

const LOW_END_MEMORY_BYTES = 3 * 1024 ** 3;
const IS_LOW_END_DEVICE = Device.totalMemory != null && Device.totalMemory < LOW_END_MEMORY_BYTES;
const STATIC_SCENE_SECONDS = 12;
const MAX_FRAME_STEP_MS = 100;
const SCENE_FADE = { duration: 900, easing: Easing.inOut(Easing.quad) };

type SceneEntry = { id: number; scene: WeatherScene };

type SceneSize = { width: number; height: number };

type SceneTextures = {
  particle: SharedValue<SkImage | null>;
  cloud: SharedValue<SkImage | null>;
  rays: SharedValue<SkImage | null>;
};

/** 장면이 바뀌면 이전 장면을 지우지 않고 남겨 두었다가 새 장면과 교차해 사라지게 한다. */
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

export function WeatherSceneCanvas({ scene }: { scene: WeatherScene }) {
  const window = useWindowDimensions();
  const [layoutSize, setLayoutSize] = useState<SceneSize | null>(null);
  const { width, height } = layoutSize ?? window;
  const { theme } = useUniwind();
  const isAnimating = useWeatherSceneClock();
  const time = useSharedValue(STATIC_SCENE_SECONDS);
  const frameClock = useFrameCallback((frame) => {
    const step = Math.min(frame.timeSincePreviousFrame ?? 0, MAX_FRAME_STEP_MS);
    time.set(time.get() + step / 1000);
  }, false);
  const textures = {
    particle: useParticleTexture(),
    cloud: useCloudTexture(),
    rays: useSunRaysTexture(),
  };
  const { entries, current, finishFade } = useSceneCrossFade(scene);

  useEffect(() => {
    frameClock.setActive(isAnimating);
  }, [frameClock, isAnimating]);

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width: nextWidth, height: nextHeight } = event.nativeEvent.layout;
    setLayoutSize((previous) =>
      previous?.width === nextWidth && previous.height === nextHeight
        ? previous
        : { width: nextWidth, height: nextHeight },
    );
  };

  // Skia Canvas는 onLayout을 받지 않아 감싼 View에서 크기를 잰다.
  return (
    <View
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
            size={{ width, height }}
            time={time}
            textures={textures}
            onFaded={finishFade}
          />
        ))}
        <ScrimLayer isDaylight={current.scene.isDaylight} width={width} height={height} />
      </Canvas>
    </View>
  );
}

type SceneLayersProps = {
  entry: SceneEntry;
  isLeaving: boolean;
  isFirst: boolean;
  isAnimating: boolean;
  size: SceneSize;
  time: SharedValue<number>;
  textures: SceneTextures;
  onFaded: (id: number) => void;
};

function SceneLayers({
  entry,
  isLeaving,
  isFirst,
  isAnimating,
  size,
  time,
  textures,
  onFaded,
}: SceneLayersProps) {
  const { id, scene } = entry;
  const opacity = useSharedValue(isFirst ? 1 : 0);

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
  const layout = { ...size, time };
  const particles = {
    ...layout,
    isDaylight: scene.isDaylight,
    isLowEndDevice: IS_LOW_END_DEVICE,
    texture: textures.particle,
  };
  const rain = { speed: precipitation.speed, angle: precipitation.angle };

  return (
    <Group opacity={opacity}>
      {scene.sun && (
        <SunGlowLayer
          width={size.width}
          time={time}
          clouds={scene.clouds}
          isHot={scene.sky === 'hotDay'}
          rays={textures.rays}
        />
      )}
      {scene.stars && <StarLayer {...layout} clouds={scene.clouds} />}
      <CloudLayer
        {...layout}
        amount={scene.clouds}
        wind={scene.wind}
        sky={scene.sky}
        texture={textures.cloud}
      />
      {match(precipitation.kind)
        .with('none', () => null)
        .with('rain', () => (
          <RainLayer {...particles} {...rain} variant="rain" density={precipitation.density} />
        ))
        .with('hail', () => (
          <>
            <RainLayer
              {...particles}
              {...rain}
              variant="rain"
              density={precipitation.density * 0.5}
            />
            <RainLayer {...particles} {...rain} variant="hail" density={precipitation.density} />
          </>
        ))
        .with('sleet', () => (
          <>
            <RainLayer
              {...particles}
              {...rain}
              variant="rain"
              density={precipitation.density * 0.6}
            />
            <SnowLayer
              {...particles}
              density={precipitation.density * 0.5}
              speed={Math.min(1, precipitation.speed + 0.3)}
              wind={scene.wind}
            />
          </>
        ))
        .with('snow', () => (
          <SnowLayer
            {...particles}
            density={precipitation.density}
            speed={precipitation.speed}
            wind={scene.wind}
          />
        ))
        .exhaustive()}
      {scene.fog > 0 && (
        <FogLayer {...layout} amount={scene.fog} sky={scene.sky} texture={textures.cloud} />
      )}
      {scene.lightning && isAnimating && <LightningLayer {...layout} />}
    </Group>
  );
}
