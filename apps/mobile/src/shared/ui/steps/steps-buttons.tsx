import { useReduceMotion } from '@src/shared/hooks/use-reduce-motion';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { cn } from '@src/shared/utils/cn';
import { PressableFeedback } from 'heroui-native';
import type { LayoutChangeEvent } from 'react-native';
import { StyleSheet, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
} from 'react-native-reanimated';

import { FillCheckIcon } from '../icon/icons';
import { Text } from '../text/text';
import { STEPS_SPRING_CONFIG, springTo } from './steps-motion';

const GAP = 10;
const BACK_WIDTH_RATIO = 0.25;
const CHECK_SLOT_WIDTH = 22;
const CHECK_SLOT_GAP = 6;
const CHECK_SIZE = 16;

interface StepsButtonsProps {
  index: number;
  isLast: boolean;
  backLabel: string;
  nextLabel: string;
  onBack: () => void;
  onNext: () => void;
}

/**
 * 첫 단계는 다음 버튼이 전체 폭이고, 둘째 단계부터 뒤로 버튼이 폭의 25%로 나타난다.
 * 버튼은 단계가 바뀌어도 그대로 남아, 막지 않으면 연타가 다음 단계까지 건너뛴다.
 */
export function StepsButtons({
  index,
  isLast,
  backLabel,
  nextLabel,
  onBack,
  onNext,
}: StepsButtonsProps) {
  const isReduced = useReduceMotion();
  const containerWidth = useSharedValue(0);
  const canGoBack = index > 0;
  const handleBack = useSingleTap(onBack);
  const handleNext = useSingleTap(onNext);

  const backProgress = useDerivedValue(() =>
    springTo(canGoBack ? 1 : 0, isReduced, STEPS_SPRING_CONFIG),
  );
  const checkProgress = useDerivedValue(() =>
    springTo(isLast ? 1 : 0, isReduced, STEPS_SPRING_CONFIG),
  );

  const backWidth = useDerivedValue(() => (containerWidth.get() - GAP) * BACK_WIDTH_RATIO);

  const backSlotStyle = useAnimatedStyle(() => ({
    width: interpolate(backProgress.get(), [0, 1], [0, backWidth.get()]),
    marginRight: interpolate(backProgress.get(), [0, 1], [0, GAP]),
    overflow: 'hidden',
  }));

  const backInnerStyle = useAnimatedStyle(() => ({
    opacity: backProgress.get(),
    width: backWidth.get(),
  }));

  const checkStyle = useAnimatedStyle(() => ({
    width: interpolate(checkProgress.get(), [0, 1], [0, CHECK_SLOT_WIDTH]),
    opacity: checkProgress.get(),
    marginRight: interpolate(checkProgress.get(), [0, 1], [0, CHECK_SLOT_GAP]),
  }));

  const handleLayout = (event: LayoutChangeEvent) => {
    containerWidth.set(event.nativeEvent.layout.width);
  };

  return (
    <View onLayout={handleLayout} style={styles.row}>
      <Animated.View
        pointerEvents={canGoBack ? 'auto' : 'none'}
        accessibilityElementsHidden={!canGoBack}
        importantForAccessibility={canGoBack ? 'auto' : 'no-hide-descendants'}
        style={backSlotStyle}
      >
        <Animated.View style={backInnerStyle}>
          <PressableFeedback
            accessibilityRole="button"
            onPress={handleBack}
            className={cn(BUTTON_CLASS, 'bg-gray-9/10')}
          >
            <Text size="b2" weight="bold" shade={10}>
              {backLabel}
            </Text>
          </PressableFeedback>
        </Animated.View>
      </Animated.View>
      <View style={styles.next}>
        <PressableFeedback
          accessibilityRole="button"
          onPress={handleNext}
          className={cn(BUTTON_CLASS, 'bg-main')}
        >
          <View style={styles.label}>
            <Animated.View style={[styles.check, checkStyle]}>
              <FillCheckIcon
                width={CHECK_SIZE}
                height={CHECK_SIZE}
                colorClassName="text-white dark:text-gray-9"
              />
            </Animated.View>
            <Text size="b2" weight="bold" className="text-white dark:text-gray-9">
              {nextLabel}
            </Text>
          </View>
        </PressableFeedback>
      </View>
    </View>
  );
}

const BUTTON_CLASS = 'h-[60px] items-center justify-center rounded-[30px]';

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    width: '100%',
  },
  next: { flex: 1 },
  label: { alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  check: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
