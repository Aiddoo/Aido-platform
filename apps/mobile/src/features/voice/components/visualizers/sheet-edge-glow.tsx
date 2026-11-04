import { BlurMask, Canvas, RoundedRect, SweepGradient, vec } from '@shopify/react-native-skia';
import type { ComponentProps } from 'react';
import { useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import {
  type SharedValue,
  useDerivedValue,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
} from 'react-native-reanimated';

import { VOICE_EDGE_GLOW, VOICE_GRADIENT_COLORS } from '../../constants/voice.constants';
import { useSkiaColor } from '../../hooks/use-skia-color';

const SHEET_RADIUS = 32;
const FULL_TURN = 360;

interface SheetEdgeGlowProps extends Omit<ComponentProps<typeof Canvas>, 'children'> {
  level: SharedValue<number>;
  /** 듣지 않을 때는 프레임 콜백을 꺼 마지막 모양을 그대로 둔다 */
  isActive: boolean;
}

/** 듣는 동안 시트 테두리를 따라 천천히 도는 빛. 밝기는 음량을 따르고 소리가 없으면 옅어진다 */
export function SheetEdgeGlow({ level, isActive, style, ...canvasProps }: SheetEdgeGlowProps) {
  const isReducedMotion = useReducedMotion();
  const mainColor = useSkiaColor('text-main');
  const [size, setSize] = useState({ width: 0, height: 0 });
  const angle = useSharedValue(0);
  const smoothed = useSharedValue(0);

  useFrameCallback((frame) => {
    smoothed.set(smoothed.get() + (level.get() - smoothed.get()) * 0.08);
    const turned = (frame.timeSincePreviousFrame ?? 0) / VOICE_EDGE_GLOW.rotationPeriodMs;
    angle.set((angle.get() + turned * FULL_TURN) % FULL_TURN);
  }, isActive && !isReducedMotion);

  const opacity = useDerivedValue(
    () => VOICE_EDGE_GLOW.minOpacity + (1 - VOICE_EDGE_GLOW.minOpacity) * smoothed.get(),
  );
  const rotation = useDerivedValue(() => [{ rotate: (angle.get() * Math.PI) / 180 }]);
  const center = vec(size.width / 2, size.height / 2);
  const inset = VOICE_EDGE_GLOW.strokeWidth;

  const handleLayout = ({ nativeEvent }: LayoutChangeEvent) => {
    setSize({ width: nativeEvent.layout.width, height: nativeEvent.layout.height });
  };

  return (
    <Canvas
      {...canvasProps}
      pointerEvents="none"
      onLayout={handleLayout}
      style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }, style]}
    >
      <RoundedRect
        x={inset}
        y={inset}
        width={Math.max(0, size.width - inset * 2)}
        height={Math.max(0, size.height - inset * 2)}
        r={SHEET_RADIUS}
        style="stroke"
        strokeWidth={VOICE_EDGE_GLOW.strokeWidth}
        opacity={opacity}
      >
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
        <BlurMask blur={VOICE_EDGE_GLOW.blur} style="solid" />
      </RoundedRect>
    </Canvas>
  );
}
