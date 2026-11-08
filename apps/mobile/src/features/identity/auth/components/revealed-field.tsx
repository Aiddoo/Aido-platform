import { ANIMATION } from '@src/shared/constants/animation';
import type { ReactNode } from 'react';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

interface RevealedFieldProps {
  onRevealed: () => void;
  children: ReactNode;
}

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
