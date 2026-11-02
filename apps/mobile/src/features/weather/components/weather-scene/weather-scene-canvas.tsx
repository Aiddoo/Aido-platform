import { Canvas } from '@shopify/react-native-skia';
import * as Device from 'expo-device';
import { useEffect } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { useFrameCallback, useSharedValue } from 'react-native-reanimated';
import { match } from 'ts-pattern';

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
import { useCloudTexture, useParticleTexture } from './weather-scene-textures';

const LOW_END_MEMORY_BYTES = 3 * 1024 ** 3;
const IS_LOW_END_DEVICE = Device.totalMemory != null && Device.totalMemory < LOW_END_MEMORY_BYTES;
const STATIC_SCENE_SECONDS = 12;
const MAX_FRAME_STEP_MS = 100;

export function WeatherSceneCanvas({ scene }: { scene: WeatherScene }) {
  const { width, height } = useWindowDimensions();
  const isAnimating = useWeatherSceneClock();
  const time = useSharedValue(STATIC_SCENE_SECONDS);
  const frameClock = useFrameCallback((frame) => {
    const step = Math.min(frame.timeSincePreviousFrame ?? 0, MAX_FRAME_STEP_MS);
    time.set(time.get() + step / 1000);
  }, false);
  const particleTexture = useParticleTexture();
  const cloudTexture = useCloudTexture();

  useEffect(() => {
    frameClock.setActive(isAnimating);
  }, [frameClock, isAnimating]);

  const { precipitation } = scene;
  const layout = { width, height, time };
  const particles = {
    ...layout,
    isDaylight: scene.isDaylight,
    isLowEndDevice: IS_LOW_END_DEVICE,
    texture: particleTexture,
  };
  const rain = { speed: precipitation.speed, angle: precipitation.angle };

  return (
    <Canvas
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      opaque
      highBitDepth={!IS_LOW_END_DEVICE}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <SkyGradientLayer sky={scene.sky} width={width} height={height} />
      {scene.sun && (
        <SunGlowLayer {...layout} clouds={scene.clouds} isHot={scene.sky === 'hotDay'} />
      )}
      {scene.stars && <StarLayer {...layout} clouds={scene.clouds} />}
      <CloudLayer
        {...layout}
        amount={scene.clouds}
        wind={scene.wind}
        sky={scene.sky}
        texture={cloudTexture}
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
        <FogLayer {...layout} amount={scene.fog} sky={scene.sky} texture={cloudTexture} />
      )}
      {scene.lightning && isAnimating && <LightningLayer {...layout} />}
      <ScrimLayer isDaylight={scene.isDaylight} width={width} height={height} />
    </Canvas>
  );
}
