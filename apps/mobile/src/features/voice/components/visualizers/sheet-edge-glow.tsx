import {
  BlurMask,
  Canvas,
  Group,
  RoundedRect,
  SweepGradient,
  vec,
} from '@shopify/react-native-skia';
import { useReduceMotion } from '@src/shared/hooks/use-reduce-motion';
import { SHEET_RADIUS } from '@src/shared/ui';
import { useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  type SharedValue,
  useDerivedValue,
  useSharedValue,
} from 'react-native-reanimated';

import { VOICE_EDGE_GLOW, VOICE_GRADIENT_COLORS } from '../../constants/voice.constants';
import { useSkiaColor } from '../../hooks/use-skia-color';
import { useSkiaDensityScale } from '../../hooks/use-skia-density-scale';
import { useVoiceFrameCallback } from '../../hooks/use-voice-frame-callback';
import { followLevel } from '../../utils/view-models/waveform.view-model';

const BLEED = VOICE_EDGE_GLOW.blur * 3;
const FULL_TURN_RADIANS = Math.PI * 2;

interface SheetEdgeGlowProps {
  level: SharedValue<number>;
}

/** `KeyboardBottomSheet`의 `backgroundDecoration`으로 시트 면 뒤에 깐다 */
export function SheetEdgeGlow({ level }: SheetEdgeGlowProps) {
  const isReducedMotion = useReduceMotion();
  const mainColor = useSkiaColor('text-main');
  const densityScale = useSkiaDensityScale();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const angle = useSharedValue(0);
  const smoothed = useSharedValue(0);

  useVoiceFrameCallback((frame) => {
    'worklet';
    const elapsed = frame.timeSincePreviousFrame ?? 0;
    const next = followLevel(smoothed.get(), level.get(), elapsed, VOICE_EDGE_GLOW);
    smoothed.set(next);
    angle.set(
      (angle.get() + (elapsed / VOICE_EDGE_GLOW.rotationPeriodMs) * FULL_TURN_RADIANS * next) %
        FULL_TURN_RADIANS,
    );
  }, !isReducedMotion);

  const opacity = useDerivedValue(
    () => VOICE_EDGE_GLOW.minOpacity + (1 - VOICE_EDGE_GLOW.minOpacity) * smoothed.get(),
  );
  const rotation = useDerivedValue(() => [{ rotate: angle.get() }]);
  const width = Math.max(0, size.width - BLEED * 2);
  const height = Math.max(0, size.height - BLEED * 2);
  const center = vec(size.width / 2, size.height / 2);
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

  const handleLayout = ({ nativeEvent }: LayoutChangeEvent) => {
    setSize({ width: nativeEvent.layout.width, height: nativeEvent.layout.height });
  };

  // Skia Canvas는 onLayout을 받지 않고 Box는 등장·퇴장 애니메이션이 없어 Animated.View에서 크기를 잰다
  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(150)}
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
