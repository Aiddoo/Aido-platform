import { useIsAnimationActive } from '@src/shared/hooks/use-is-animation-active';
import { useEffect } from 'react';
import {
  cancelAnimation,
  Easing,
  ReduceMotion,
  type SharedValue,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { DEMO_WAVEFORM_LEVELS } from '../constants/release-1-15-0.constants';

/** 실제 세션이 음량을 내는 간격과 비슷해야 파형·원이 말하는 것처럼 오르내린다 */
const DEMO_LEVEL_STEP_MS = 120;
const DEMO_LEVEL_SETTLE_MS = 300;

/**
 * 마이크 없이 실제 음성 시각화 부품에 넣을 0..1 음량. UI 스레드 애니메이션이라 JS가 다시 그리지 않고,
 * 말이 끝나거나 장면이 사라지거나 화면이 가려지면 멈춘다
 */
export function useDemoVoiceLevel({ isSpeaking }: { isSpeaking: boolean }): SharedValue<number> {
  const isAnimating = useIsAnimationActive();
  const level = useSharedValue(0);
  const isMoving = isSpeaking && isAnimating;

  useEffect(() => {
    if (!isMoving) {
      level.set(
        withTiming(0, { duration: DEMO_LEVEL_SETTLE_MS, reduceMotion: ReduceMotion.System }),
      );
      return () => cancelAnimation(level);
    }

    const step = {
      duration: DEMO_LEVEL_STEP_MS,
      easing: Easing.inOut(Easing.quad),
      reduceMotion: ReduceMotion.System,
    };
    level.set(
      withRepeat(withSequence(...DEMO_WAVEFORM_LEVELS.map((value) => withTiming(value, step))), -1),
    );
    return () => cancelAnimation(level);
  }, [isMoving, level]);

  return level;
}
