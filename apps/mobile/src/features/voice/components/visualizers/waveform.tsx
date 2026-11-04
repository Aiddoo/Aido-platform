import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { range } from 'es-toolkit';
import type { ComponentProps } from 'react';
import {
  type SharedValue,
  useDerivedValue,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
} from 'react-native-reanimated';

import { VOICE_WAVEFORM } from '../../constants/voice.constants';
import { useSkiaColor } from '../../hooks/use-skia-color';

const BAR_STEP = VOICE_WAVEFORM.barWidth + VOICE_WAVEFORM.barGap;
export const WAVEFORM_WIDTH = VOICE_WAVEFORM.barCount * BAR_STEP - VOICE_WAVEFORM.barGap;

interface WaveformProps extends Omit<ComponentProps<typeof Canvas>, 'children'> {
  level: SharedValue<number>;
  /** 쉴 때(말이 없거나 계획 중)는 프레임 콜백을 끄고 마지막 모양을 그대로 둔다 */
  isActive: boolean;
}

/** 음량을 오른쪽에서 왼쪽으로 흘려보내는 48칸 막대. React 렌더 없이 UI 스레드에서만 그린다 */
export function Waveform({ level, isActive, style, ...canvasProps }: WaveformProps) {
  const isReducedMotion = useReducedMotion();
  const color = useSkiaColor('text-main');
  const samples = useSharedValue<number[]>(range(VOICE_WAVEFORM.barCount).map(() => 0));
  const sinceLastSample = useSharedValue(0);
  const isMoving = isActive && !isReducedMotion;

  // 콜백을 다시 켜면 첫 프레임 기준 시간이 0으로 돌아가므로 프레임 사이 시간을 더해 잰다
  useFrameCallback((frame) => {
    const elapsed = sinceLastSample.get() + (frame.timeSincePreviousFrame ?? 0);
    if (elapsed < VOICE_WAVEFORM.sampleIntervalMs) {
      sinceLastSample.set(elapsed);
      return;
    }
    sinceLastSample.set(0);
    const next = samples.get().slice(1);
    next.push(level.get());
    samples.set(next);
  }, isMoving);

  // Reanimated 매퍼는 넘겨받은 콜백 안의 shared value를 입력으로 찾지 않아(`usePathValue`) 값을 직접 읽는 `useDerivedValue`로 만든다
  const path = useDerivedValue(() => {
    const target = Skia.PathBuilder.Make();
    const values = samples.get();
    for (let index = 0; index < values.length; index += 1) {
      const ratio = Math.max(VOICE_WAVEFORM.minBarRatio, values[index] ?? 0);
      const height = ratio * VOICE_WAVEFORM.height;
      const rect = Skia.XYWHRect(
        index * BAR_STEP,
        (VOICE_WAVEFORM.height - height) / 2,
        VOICE_WAVEFORM.barWidth,
        height,
      );
      target.addRRect(Skia.RRectXY(rect, VOICE_WAVEFORM.barWidth / 2, VOICE_WAVEFORM.barWidth / 2));
    }
    return target.build();
  });

  return (
    <Canvas
      {...canvasProps}
      style={[{ width: WAVEFORM_WIDTH, height: VOICE_WAVEFORM.height }, style]}
    >
      <Path path={path} color={color} />
    </Canvas>
  );
}
