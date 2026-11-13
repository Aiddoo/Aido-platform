import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useIsReduceMotionEnabled } from '@src/shared/hooks/use-is-reduce-motion-enabled';
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

import { CheckmarkIcon } from '../icon/icons';
import { Text } from '../text/text';
import { STEPS_SPRING_CONFIG, springTo } from './steps-motion';

const GAP = 10;
const BACK_WIDTH_RATIO = 0.25;
const CHECK_SLOT_WIDTH = 22;
const CHECK_SLOT_GAP = 6;
const CHECK_SIZE = 18;

interface StepsButtonsProps {
  index: number;
  isLast: boolean;
  backLabel: string;
  nextLabel: string;
  onBack: () => void;
  onNext: () => void;
}

/** 버튼은 단계가 바뀌어도 그대로 남아, 막지 않으면 연타가 다음 단계까지 건너뛴다 */
export function StepsButtons({
  index,
  isLast,
  backLabel,
  nextLabel,
  onBack,
  onNext,
}: StepsButtonsProps) {
  const isReducedMotion = useIsReduceMotionEnabled();
  const fontScaledSize = useFontScaledSize();
  // 체크는 옆 글자와 함께 커지고 슬롯도 같은 비율로 넓힌다
  const checkSize = fontScaledSize(CHECK_SIZE);
  const checkSlotWidth = fontScaledSize(CHECK_SLOT_WIDTH);
  const containerWidth = useSharedValue(0);
  const canGoBack = index > 0;
  const handleBack = useSingleTap(onBack);
  const handleNext = useSingleTap(onNext);

  const backProgress = useDerivedValue(() =>
    springTo(canGoBack ? 1 : 0, isReducedMotion, STEPS_SPRING_CONFIG),
  );
  const checkProgress = useDerivedValue(() =>
    springTo(isLast ? 1 : 0, isReducedMotion, STEPS_SPRING_CONFIG),
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
    width: interpolate(checkProgress.get(), [0, 1], [0, checkSlotWidth]),
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
            className={cn(BUTTON_CLASS, 'bg-gray-9/5 dark:bg-gray-9/20')}
          >
            <Text size="b3" weight="semibold" shade={9}>
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
              <CheckmarkIcon
                width={checkSize}
                height={checkSize}
                colorClassName="text-white dark:text-gray-9"
              />
            </Animated.View>
            <Text size="b3" weight="semibold" className="text-white dark:text-gray-9">
              {nextLabel}
            </Text>
          </View>
        </PressableFeedback>
      </View>
    </View>
  );
}

// 공용 Button의 xlarge·lg와 같은 높이·모서리다
const BUTTON_CLASS = 'h-14 items-center justify-center rounded-xl';

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    width: '100%',
  },
  next: { flex: 1 },
  label: { alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  check: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
