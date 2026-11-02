import {
  Blur,
  Circle,
  Group,
  LinearGradient,
  Paint,
  RadialGradient,
  RoundedRect,
  useTexture,
  vec,
} from '@shopify/react-native-skia';

export const PARTICLE_TEXTURE_SCALE = 3;

export const PARTICLE_SPRITES = {
  streak: { x: 0, y: 0, width: 6, height: 96 },
  flake: { x: 8, y: 0, width: 32, height: 32 },
  pellet: { x: 44, y: 0, width: 24, height: 24 },
} as const;

export type ParticleSprite = (typeof PARTICLE_SPRITES)[keyof typeof PARTICLE_SPRITES];

const PARTICLE_TEXTURE_SIZE = { width: 72, height: 96 };

export const CLOUD_SPRITE = { x: 0, y: 0, width: 360, height: 200 } as const;

const CLOUD_TEXTURE_SIZE = { width: CLOUD_SPRITE.width, height: CLOUD_SPRITE.height };

const CLOUD_PUFFS = [
  { cx: 96, cy: 122, r: 52 },
  { cx: 160, cy: 96, r: 66 },
  { cx: 236, cy: 108, r: 58 },
  { cx: 290, cy: 132, r: 40 },
] as const;

export function useParticleTexture() {
  const { streak, flake, pellet } = PARTICLE_SPRITES;
  const flakeCenter = vec(flake.x + flake.width / 2, flake.y + flake.height / 2);
  const pelletCenter = vec(pellet.x + pellet.width / 2, pellet.y + pellet.height / 2);
  return useTexture(
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
          colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.95)']}
        />
      </RoundedRect>
      <Circle c={flakeCenter} r={flake.width / 2}>
        <RadialGradient
          c={flakeCenter}
          r={flake.width / 2}
          colors={['rgba(255,255,255,1)', 'rgba(255,255,255,0.7)', 'rgba(255,255,255,0)']}
          positions={[0, 0.4, 1]}
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
  return useTexture(
    <Group
      layer={
        <Paint>
          <Blur blur={18} />
        </Paint>
      }
    >
      {CLOUD_PUFFS.map((puff) => (
        <Circle key={puff.cx} cx={puff.cx} cy={puff.cy} r={puff.r} color="white" />
      ))}
      <RoundedRect x={60} y={118} width={250} height={48} r={24} color="white" />
    </Group>,
    CLOUD_TEXTURE_SIZE,
  );
}
