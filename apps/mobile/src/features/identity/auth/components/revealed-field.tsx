import { ANIMATION } from '@src/shared/constants/animation';
import type { ReactNode } from 'react';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

interface RevealedFieldProps {
  /** 나타나는 애니메이션이 끝나면 한 번 부른다. 보통 새 입력칸에 포커스를 준다 */
  onRevealed: () => void;
  children: ReactNode;
}

/** 다음 단계에서 새로 나타나는 입력칸. 위로 떠오르며 보이고, 다 보이면 `onRevealed`를 부른다 */
export function RevealedField({ onRevealed, children }: RevealedFieldProps) {
  return (
    <Animated.View
      entering={FadeInUp.duration(ANIMATION.duration.slow)
        .delay(ANIMATION.delay.short)
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
