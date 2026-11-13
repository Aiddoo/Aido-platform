import {
  BlurMask,
  Canvas,
  Group,
  RoundedRect,
  SweepGradient,
  vec,
} from '@shopify/react-native-skia';
import { ANIMATION } from '@src/shared/constants/animation';
import { useIsAnimationActive } from '@src/shared/hooks/use-is-animation-active';
import { useResolvedColor } from '@src/shared/hooks/use-resolved-color';
import { SHEET_RADIUS } from '@src/shared/ui';
import type { LayoutChangeEvent } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  type SharedValue,
  useDerivedValue,
  useSharedValue,
} from 'react-native-reanimated';

import { VOICE_EDGE_GLOW, VOICE_GRADIENT_COLORS } from '../constants/voice.constants';
import { useSkiaDensityScale } from '../hooks/use-skia-density-scale';
import { useToggleableFrameCallback } from '../hooks/use-toggleable-frame-callback';
import { followLevel } from '../utils/waveform.geometry';

const BLEED = VOICE_EDGE_GLOW.blur * 3;
const FULL_TURN_RADIANS = Math.PI * 2;

interface SheetEdgeGlowProps {
  level: SharedValue<number>;
}

export function SheetEdgeGlow({ level }: SheetEdgeGlowProps) {
  const isAnimationActive = useIsAnimationActive();
  const mainColor = useResolvedColor('text-main');
  const densityScale = useSkiaDensityScale();
  const size = useSharedValue({ width: 0, height: 0 });
  const angle = useSharedValue(0);
  const smoothed = useSharedValue(0);

  useToggleableFrameCallback(
    (frame) => {
      'worklet';
      const elapsed = frame.timeSincePreviousFrame ?? 0;
      const next = followLevel(smoothed.get(), level.get(), elapsed, VOICE_EDGE_GLOW);
      smoothed.set(next);
      angle.set(
        (angle.get() + (elapsed / VOICE_EDGE_GLOW.rotationPeriodMs) * FULL_TURN_RADIANS * next) %
          FULL_TURN_RADIANS,
      );
    },
    { isActive: isAnimationActive },
  );

  const opacity = useDerivedValue(
    () => VOICE_EDGE_GLOW.minOpacity + (1 - VOICE_EDGE_GLOW.minOpacity) * smoothed.get(),
  );
  const rotation = useDerivedValue(() => [{ rotate: angle.get() }]);
  const handleLayout = ({ nativeEvent }: LayoutChangeEvent) => {
    size.set({ width: nativeEvent.layout.width, height: nativeEvent.layout.height });
  };

  const width = useDerivedValue(() => Math.max(0, size.get().width - BLEED * 2));
  const height = useDerivedValue(() => Math.max(0, size.get().height - BLEED * 2));
  const center = useDerivedValue(() => vec(size.get().width / 2, size.get().height / 2));
  const gradient = (
    <SweepGradient
      c={center}
      colors={[
        mainColor,
        VOICE_GRADIENT_COLORS.glowApricot,
        VOICE_GRADIENT_COLORS.glowRose,
        VOICE_GRADIENT_COLORS.glowCream,
        mainColor,
      ]}
      origin={center}
      transform={rotation}
    />
  );

  return (
    <Animated.View
      entering={FadeIn.duration(ANIMATION.durationMs.normal)}
      exiting={FadeOut.duration(ANIMATION.durationMs.fast)}
      pointerEvents="none"
      onLayout={handleLayout}
      style={{ position: 'absolute', top: -BLEED, right: -BLEED, bottom: -BLEED, left: -BLEED }}
      testID="sheet-edge-glow"
    >
      <Canvas style={{ flex: 1 }}>
        <Group transform={[{ scale: densityScale }]} opacity={opacity}>
          <RoundedRect x={BLEED} y={BLEED} width={width} height={height} r={SHEET_RADIUS}>
            {gradient}
            <BlurMask blur={VOICE_EDGE_GLOW.blur} style="outer" />
          </RoundedRect>
          <RoundedRect
            x={BLEED}
            y={BLEED}
            width={width}
            height={height}
            r={SHEET_RADIUS}
            style="stroke"
            strokeWidth={VOICE_EDGE_GLOW.rimWidth}
          >
            {gradient}
          </RoundedRect>
        </Group>
      </Canvas>
    </Animated.View>
  );
}
