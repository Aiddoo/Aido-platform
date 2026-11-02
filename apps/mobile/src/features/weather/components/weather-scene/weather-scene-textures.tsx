import {
  Blur,
  Circle,
  FilterMode,
  Group,
  LinearGradient,
  MipmapMode,
  Paint,
  Path,
  RadialGradient,
  RoundedRect,
  Skia,
  type SkSize,
  useTexture,
  vec,
} from '@shopify/react-native-skia';
import { range } from 'es-toolkit';
import { type ReactElement, useEffect, useMemo } from 'react';
import { scheduleOnUI } from 'react-native-worklets';

import { createSeededRandom } from './weather-scene-particles';

export const PARTICLE_TEXTURE_SCALE = 3;

export const PARTICLE_SPRITES = {
  streak: { x: 0, y: 0, width: 3, height: 72 },
  flake: { x: 8, y: 0, width: 30, height: 30 },
  flakeSoft: { x: 8, y: 36, width: 36, height: 36 },
  pellet: { x: 46, y: 0, width: 24, height: 24 },
} as const;

export type ParticleSprite = (typeof PARTICLE_SPRITES)[keyof typeof PARTICLE_SPRITES];

/** 축소해 그릴 때 1px 빗줄기가 계단지지 않도록 선형 보간한다. */
export const PARTICLE_SAMPLING = { filter: FilterMode.Linear, mipmap: MipmapMode.None };

const PARTICLE_TEXTURE_SIZE = { width: 72, height: 76 };

export const CLOUD_SPRITE = { x: 0, y: 0, width: 400, height: 240 } as const;

const CLOUD_TEXTURE_SIZE = { width: CLOUD_SPRITE.width, height: CLOUD_SPRITE.height };

const CLOUD_BLUR = 22;

const CLOUD_PUFFS = [
  { cx: 130, cy: 140, r: 46 },
  { cx: 196, cy: 120, r: 60 },
  { cx: 266, cy: 130, r: 50 },
  { cx: 318, cy: 152, r: 34 },
] as const;

export const SUN_RAYS_SIZE = 480;

const SUN_RAY_COUNT = 14;
const SUN_RAYS_SEED = 0x5a7;

function buildSunRaysPath() {
  const random = createSeededRandom(SUN_RAYS_SEED);
  const center = SUN_RAYS_SIZE / 2;
  const builder = Skia.PathBuilder.Make();
  for (const index of range(SUN_RAY_COUNT)) {
    const angle = ((index + random() * 0.6) / SUN_RAY_COUNT) * Math.PI * 2;
    const halfWidth = (0.012 + random() * 0.022) * Math.PI;
    const length = center * (0.62 + random() * 0.38);
    builder
      .moveTo(center, center)
      .lineTo(
        center + Math.cos(angle - halfWidth) * length,
        center + Math.sin(angle - halfWidth) * length,
      )
      .lineTo(
        center + Math.cos(angle + halfWidth) * length,
        center + Math.sin(angle + halfWidth) * length,
      )
      .close();
  }
  return builder.detach();
}

/** 한 번만 구운 텍스처를 캔버스가 사라질 때 UI 스레드에서 해제한다. */
function useOwnedTexture(element: ReactElement, size: SkSize) {
  const texture = useTexture(element, size);
  useEffect(
    () => () => {
      scheduleOnUI(() => {
        'worklet';
        const image = texture.get();
        texture.set(null);
        image?.dispose();
      });
    },
    [texture],
  );
  return texture;
}

export function useParticleTexture() {
  const { streak, flake, flakeSoft, pellet } = PARTICLE_SPRITES;
  const flakeCenter = vec(flake.x + flake.width / 2, flake.y + flake.height / 2);
  const softCenter = vec(flakeSoft.x + flakeSoft.width / 2, flakeSoft.y + flakeSoft.height / 2);
  const pelletCenter = vec(pellet.x + pellet.width / 2, pellet.y + pellet.height / 2);
  return useOwnedTexture(
    <Group>
      <RoundedRect
        x={streak.x}
        y={streak.y}
        width={streak.width}
        height={streak.height}
        r={streak.width / 2}
      >
        <LinearGradient
          start={vec(0, streak.y)}
          end={vec(0, streak.y + streak.height)}
          colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.35)', 'rgba(255,255,255,1)']}
          positions={[0, 0.55, 1]}
        />
      </RoundedRect>
      <Circle c={flakeCenter} r={flake.width / 2}>
        <RadialGradient
          c={flakeCenter}
          r={flake.width / 2}
          colors={['rgba(255,255,255,1)', 'rgba(255,255,255,0.85)', 'rgba(255,255,255,0)']}
          positions={[0, 0.45, 1]}
        />
      </Circle>
      <Circle c={softCenter} r={flakeSoft.width / 2}>
        <RadialGradient
          c={softCenter}
          r={flakeSoft.width / 2}
          colors={['rgba(255,255,255,0.9)', 'rgba(255,255,255,0.4)', 'rgba(255,255,255,0)']}
          positions={[0, 0.35, 1]}
        />
      </Circle>
      <Circle c={pelletCenter} r={pellet.width / 2 - 2}>
        <RadialGradient
          c={vec(pelletCenter.x - 3, pelletCenter.y - 3)}
          r={pellet.width / 2}
          colors={['rgba(255,255,255,1)', 'rgba(214,228,240,0.9)']}
        />
      </Circle>
    </Group>,
    PARTICLE_TEXTURE_SIZE,
  );
}

export function useCloudTexture() {
  return useOwnedTexture(
    <Group
      layer={
        <Paint>
          <Blur blur={CLOUD_BLUR} />
        </Paint>
      }
    >
      {CLOUD_PUFFS.map((puff) => (
        <Circle key={puff.cx} cx={puff.cx} cy={puff.cy} r={puff.r} color="white" />
      ))}
      <RoundedRect x={74} y={140} width={262} height={50} r={25} color="white" />
    </Group>,
    CLOUD_TEXTURE_SIZE,
  );
}

const SUN_RAYS_TEXTURE_SIZE = { width: SUN_RAYS_SIZE, height: SUN_RAYS_SIZE };

/** 회전하는 햇살은 흐림 처리가 비싸서 한 번만 텍스처로 구워 둔다. */
export function useSunRaysTexture() {
  const center = vec(SUN_RAYS_SIZE / 2, SUN_RAYS_SIZE / 2);
  const path = useMemo(buildSunRaysPath, []);
  return useOwnedTexture(
    <Group
      layer={
        <Paint>
          <Blur blur={5} />
        </Paint>
      }
    >
      <Path path={path}>
        <RadialGradient
          c={center}
          r={SUN_RAYS_SIZE / 2}
          colors={['rgba(255,255,255,0.9)', 'rgba(255,255,255,0.35)', 'rgba(255,255,255,0)']}
          positions={[0, 0.35, 1]}
        />
      </Path>
    </Group>,
    SUN_RAYS_TEXTURE_SIZE,
  );
}
