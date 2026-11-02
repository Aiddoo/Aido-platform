import {
  Circle,
  Group,
  Image,
  RadialGradient,
  type SkImage,
  vec,
} from '@shopify/react-native-skia';
import { clamp } from 'es-toolkit';
import { interpolate, type SharedValue, useDerivedValue } from 'react-native-reanimated';

/** 시안 기준(390pt 폭)에서 지름 420pt 빛무리의 중심은 오른쪽에서 90pt, 위에서 170pt다. */
const REFERENCE_WIDTH = 390;
const GLOW = { right: 90, top: 170, radius: 210 } as const;
const MAX_GLOW_SCALE = 1.5;
/** 시안 wxGlow: 8초 주기로 1→1.08배, 0.75→1 불투명도로 숨 쉰다. */
const BREATH_PERIOD_SECONDS = 8;
const BREATH_SCALE = 0.08;
const BREATH_OPACITY = [0.75, 1];
const UNIT = [0, 1];
const RAY_TURN_SECONDS = 180;
const SUN_COLORS = {
  warm: 'rgba(255,232,160,0.85)',
  hot: 'rgba(255,240,190,0.95)',
} as const;

type SunGlowLayerProps = {
  clouds: number;
  isHot: boolean;
  width: number;
  time: SharedValue<number>;
  rays: SharedValue<SkImage | null>;
};

export function SunGlowLayer({ clouds, isHot, width, time, rays }: SunGlowLayerProps) {
  const scale = clamp(width / REFERENCE_WIDTH, 1, MAX_GLOW_SCALE);
  const center = vec(width - GLOW.right * scale, GLOW.top * scale);
  const radius = GLOW.radius * scale;
  const raySize = radius * 1.9;
  const strength = 1 - clouds * 0.6;
  const rayOpacity = (isHot ? 0.16 : 0.11) * strength;

  const breath = useDerivedValue(
    () => 0.5 - 0.5 * Math.cos((time.get() / BREATH_PERIOD_SECONDS) * Math.PI * 2),
  );
  const opacity = useDerivedValue(() => strength * interpolate(breath.get(), UNIT, BREATH_OPACITY));
  const glowTransform = useDerivedValue(() => [{ scale: 1 + BREATH_SCALE * breath.get() }]);
  const rayTransform = useDerivedValue(() => [
    { rotate: (time.get() / RAY_TURN_SECONDS) * Math.PI * 2 },
  ]);

  return (
    <Group opacity={opacity}>
      <Circle c={center} r={radius * 1.7}>
        <RadialGradient
          c={center}
          r={radius * 1.7}
          colors={['rgba(255,226,170,0.12)', 'rgba(255,226,170,0)']}
        />
      </Circle>
      <Group transform={glowTransform} origin={center}>
        <Circle c={center} r={radius}>
          <RadialGradient
            c={center}
            r={radius}
            colors={[
              isHot ? SUN_COLORS.hot : SUN_COLORS.warm,
              'rgba(255,214,140,0.22)',
              'rgba(255,214,140,0)',
            ]}
            positions={[0, 0.38, 0.68]}
          />
        </Circle>
      </Group>
      <Group transform={rayTransform} origin={center} opacity={rayOpacity}>
        <Image
          image={rays}
          x={center.x - raySize / 2}
          y={center.y - raySize / 2}
          width={raySize}
          height={raySize}
          fit="fill"
        />
      </Group>
    </Group>
  );
}
