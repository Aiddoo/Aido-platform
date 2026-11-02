import { BlurMask, Circle, Group, RadialGradient, vec } from '@shopify/react-native-skia';
import { type SharedValue, useDerivedValue } from 'react-native-reanimated';

type SunGlowLayerProps = {
  clouds: number;
  isHot: boolean;
  width: number;
  height: number;
  time: SharedValue<number>;
};

export function SunGlowLayer({ clouds, isHot, width, height, time }: SunGlowLayerProps) {
  const center = vec(width * 0.8, height * 0.07);
  const haloRadius = Math.max(width, height) * (isHot ? 0.75 : 0.6);
  const coreRadius = width * 0.08;
  const strength = (isHot ? 1 : 0.85) * (1 - clouds * 0.6);
  const opacity = useDerivedValue(() => strength * (0.9 + 0.1 * Math.sin(time.get() * 0.35)));

  return (
    <Group opacity={opacity}>
      <Circle c={center} r={haloRadius}>
        <RadialGradient
          c={center}
          r={haloRadius}
          colors={['rgba(255,244,214,0.7)', 'rgba(255,218,160,0.24)', 'rgba(255,206,130,0)']}
          positions={[0, 0.22, 1]}
        />
      </Circle>
      <Circle c={center} r={coreRadius} color="rgba(255,251,238,0.85)">
        <BlurMask blur={coreRadius * 0.5} style="normal" />
      </Circle>
    </Group>
  );
}
