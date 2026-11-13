import { ANIMATION } from '@src/shared/constants/animation';
import type { ReactNode } from 'react';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

interface RevealedFieldProps {
  /** 나타나는 애니메이션이 끝나면 한 번 부른다. 보통 새 입력칸에 포커스를 준다 */
  onRevealed: () => void;
  children: ReactNode;
}

export function RevealedField({ onRevealed, children }: RevealedFieldProps) {
  return (
    <Animated.View
      entering={FadeInUp.duration(ANIMATION.durationMs.slow)
        .delay(ANIMATION.delayMs.short)
        .withCallback((finished) => {
          'worklet';
          if (finished) {
            scheduleOnRN(onRevealed);
          }
        })}
    >
      {children}
    </Animated.View>
  );
}
