import { Canvas, Circle, RadialGradient, vec } from '@shopify/react-native-skia';
import { type ComponentProps, useEffect } from 'react';
import {
  cancelAnimation,
  type SharedValue,
  useDerivedValue,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
} from 'react-native-reanimated';
import { useResolveClassNames } from 'uniwind';

import { VOICE_ORB } from '../../constants/voice.constants';

const PEACH = '#ffc2a3';
const CORAL = '#ff8a5c';

interface VoiceOrbProps extends Omit<ComponentProps<typeof Canvas>, 'children'> {
  /** 0..1 음량. UI 스레드에서 읽으므로 React 렌더를 일으키지 않는다 */
  level: SharedValue<number>;
  size: number;
  /** 듣지 않을 때(계획 중) 숨 쉬듯 퍼지는 고리를 멈춘다 */
  isActive?: boolean;
}

/** 차분한 주황 구와 천천히 퍼지는 고리 2개. 크기는 음량에 따라 0.54~0.66R로만 변한다 */
export function VoiceOrb({ level, size, isActive = true, style, ...canvasProps }: VoiceOrbProps) {
  const isReducedMotion = useReducedMotion();
  const { color: mainColor } = useResolveClassNames('text-main');
  const main = typeof mainColor === 'string' ? mainColor : CORAL;
  const radius = size / 2;
  const smoothed = useSharedValue(0);
  const phase = useSharedValue(0);
  const isMoving = isActive && !isReducedMotion;

  useFrameCallback((frame) => {
    if (!isMoving) {
      return;
    }
    smoothed.set(smoothed.get() + (level.get() - smoothed.get()) * VOICE_ORB.smoothing);
    phase.set(((frame.timeSinceFirstFrame ?? 0) / VOICE_ORB.ringPeriodMs) % 1);
  }, isMoving);

  useEffect(
    () => () => {
      cancelAnimation(smoothed);
      cancelAnimation(phase);
    },
    [smoothed, phase],
  );

  const orbRadius = useDerivedValue(() =>
    isMoving
      ? radius *
        (VOICE_ORB.minRadiusRatio +
          (VOICE_ORB.maxRadiusRatio - VOICE_ORB.minRadiusRatio) * smoothed.get())
      : radius * VOICE_ORB.restRadiusRatio,
  );
  const ringA = useDerivedValue(
    () => orbRadius.get() * (1 + phase.get() * VOICE_ORB.ringGrowRatio),
  );
  const ringB = useDerivedValue(
    () => orbRadius.get() * (1 + ((phase.get() + 0.5) % 1) * VOICE_ORB.ringGrowRatio),
  );
  const ringOpacityA = useDerivedValue(() => (1 - phase.get()) * (0.18 + 0.35 * smoothed.get()));
  const ringOpacityB = useDerivedValue(
    () => (1 - ((phase.get() + 0.5) % 1)) * (0.18 + 0.35 * smoothed.get()),
  );
  const highlightCenter = useDerivedValue(() =>
    vec(radius - orbRadius.get() * 0.35, radius - orbRadius.get() * 0.4),
  );

  return (
    <Canvas {...canvasProps} style={[{ width: size, height: size }, style]}>
      {isMoving && (
        <>
          <Circle
            cx={radius}
            cy={radius}
            r={ringA}
            style="stroke"
            strokeWidth={Math.max(1, radius * 0.018)}
            color={main}
            opacity={ringOpacityA}
          />
          <Circle
            cx={radius}
            cy={radius}
            r={ringB}
            style="stroke"
            strokeWidth={Math.max(1, radius * 0.018)}
            color={main}
            opacity={ringOpacityB}
          />
        </>
      )}
      <Circle cx={radius} cy={radius} r={orbRadius}>
        <RadialGradient
          c={highlightCenter}
          r={radius * VOICE_ORB.maxRadiusRatio * 1.6}
          colors={[PEACH, CORAL, main]}
          positions={[0, 0.55, 1]}
        />
      </Circle>
    </Canvas>
  );
}
