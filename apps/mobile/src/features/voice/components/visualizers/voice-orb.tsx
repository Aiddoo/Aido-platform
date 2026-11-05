import { BlurMask, Canvas, Circle, Group, RadialGradient, vec } from '@shopify/react-native-skia';
import { useReduceMotion } from '@src/shared/hooks/use-reduce-motion';
import type { ComponentProps } from 'react';
import { type SharedValue, useDerivedValue, useSharedValue } from 'react-native-reanimated';

import { VOICE_GRADIENT_COLORS, VOICE_ORB } from '../../constants/voice.constants';
import { useSkiaColor } from '../../hooks/use-skia-color';
import { useSkiaDensityScale } from '../../hooks/use-skia-density-scale';
import { useVoiceFrameCallback } from '../../hooks/use-voice-frame-callback';
import { followLevel } from '../../utils/view-models/waveform.view-model';

const HALO_RADIUS_RATIO = 1.15;
const HALO_BLUR_RATIO = 0.12;
const HALO_MAX_OPACITY = 0.55;
const RING_MAX_OPACITY = 0.7;
/** 말이 시작될 때 고리가 바로 퍼져 나가도록 조금 작은 음량에서도 움직이게 한다 */
const RING_IDLE_SPEED = 0.2;

interface VoiceOrbProps extends Omit<ComponentProps<typeof Canvas>, 'children'> {
  /** 0..1 음량. UI 스레드에서 읽으므로 React 렌더를 일으키지 않는다 */
  level: SharedValue<number>;
  size: number;
  /** 듣지 않을 때(일시정지·계획 중)는 프레임 콜백을 끄고 쉬는 크기로 둔다 */
  isActive?: boolean;
}

/**
 * 실제 음량만 따르는 구. 말하면 커지고 빛나며 고리가 퍼지고, 조용하면 고리가 사라지고 작게 가라앉는다.
 * 시간만으로 움직이는 부분은 없다. 고리도 음량만큼만 나아간다.
 */
export function VoiceOrb({ level, size, isActive = true, style, ...canvasProps }: VoiceOrbProps) {
  const isReducedMotion = useReduceMotion();
  const main = useSkiaColor('text-main');
  const densityScale = useSkiaDensityScale();
  const radius = size / 2;
  const smoothed = useSharedValue(0);
  const phase = useSharedValue(0);
  const isMoving = isActive && !isReducedMotion;

  useVoiceFrameCallback((frame) => {
    'worklet';
    const elapsed = frame.timeSincePreviousFrame ?? 0;
    const next = followLevel(smoothed.get(), level.get(), elapsed, VOICE_ORB);
    smoothed.set(next);
    const speed = next > 0 ? RING_IDLE_SPEED + (1 - RING_IDLE_SPEED) * next : 0;
    phase.set((phase.get() + (elapsed / VOICE_ORB.ringPeriodMs) * speed) % 1);
  }, isMoving);

  const orbRadius = useDerivedValue(
    () =>
      radius *
      (VOICE_ORB.minRadiusRatio +
        (VOICE_ORB.maxRadiusRatio - VOICE_ORB.minRadiusRatio) * (isMoving ? smoothed.get() : 0)),
  );
  const ringA = useDerivedValue(
    () => orbRadius.get() * (1 + phase.get() * VOICE_ORB.ringGrowRatio),
  );
  const ringB = useDerivedValue(
    () => orbRadius.get() * (1 + ((phase.get() + 0.5) % 1) * VOICE_ORB.ringGrowRatio),
  );
  const ringOpacityA = useDerivedValue(() => (1 - phase.get()) * smoothed.get() * RING_MAX_OPACITY);
  const ringOpacityB = useDerivedValue(
    () => (1 - ((phase.get() + 0.5) % 1)) * smoothed.get() * RING_MAX_OPACITY,
  );
  const haloRadius = useDerivedValue(() => orbRadius.get() * HALO_RADIUS_RATIO);
  const haloOpacity = useDerivedValue(() => smoothed.get() * HALO_MAX_OPACITY);
  const orbOpacity = useDerivedValue(() =>
    isMoving ? VOICE_ORB.quietOpacity + (1 - VOICE_ORB.quietOpacity) * smoothed.get() : 1,
  );
  const highlightCenter = useDerivedValue(() =>
    vec(radius - orbRadius.get() * 0.35, radius - orbRadius.get() * 0.4),
  );

  return (
    <Canvas {...canvasProps} style={[{ width: size, height: size }, style]}>
      <Group transform={[{ scale: densityScale }]}>
        {isMoving && (
          <>
            <Circle cx={radius} cy={radius} r={haloRadius} color={main} opacity={haloOpacity}>
              <BlurMask blur={radius * HALO_BLUR_RATIO} style="normal" />
            </Circle>
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
        <Circle cx={radius} cy={radius} r={orbRadius} opacity={orbOpacity}>
          <RadialGradient
            c={highlightCenter}
            r={radius * VOICE_ORB.maxRadiusRatio * 1.6}
            colors={[VOICE_GRADIENT_COLORS.orbPeach, VOICE_GRADIENT_COLORS.orbCoral, main]}
            positions={[0, 0.55, 1]}
          />
        </Circle>
      </Group>
    </Canvas>
  );
}
