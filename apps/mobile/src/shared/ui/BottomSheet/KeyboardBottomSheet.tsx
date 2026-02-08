import GorhomBottomSheet, {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  type BottomSheetBackgroundProps,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { ANIMATION } from '@src/shared/constants/animation.constants';
import {
  createContext,
  memo,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
} from 'react';
import { Keyboard, Platform, StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useResolveClassNames } from 'uniwind';

interface KeyboardBottomSheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  children: ReactNode;
}

const KeyboardProgressContext = createContext<SharedValue<number> | null>(null);

const SheetBackground = memo(({ style, pointerEvents }: BottomSheetBackgroundProps) => {
  const keyboardProgress = useContext(KeyboardProgressContext) as SharedValue<number>;
  const animStyle = useAnimatedStyle(() => ({
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderBottomLeftRadius: interpolate(keyboardProgress.value, [0, 1], [24, 0]),
    borderBottomRightRadius: interpolate(keyboardProgress.value, [0, 1], [24, 0]),
    borderCurve: 'continuous' as const,
  }));
  return <Animated.View pointerEvents={pointerEvents} style={[style, animStyle]} />;
});

const EXPAND_DELAY_MS = 100;

/**
 * @gorhom/bottom-sheet를 직접 사용하는 detached BottomSheet.
 *
 * HeroUI wrapper 대신 직접 사용하여:
 * - enableDynamicSizing + expand 딜레이 → 콘텐츠 높이 측정 후 열림 (간헐적 실패 방지)
 * - FullWindowOverlay 미사용 → backdrop과 sheet 동시 애니메이션 (깜빡임 제거)
 * - 키보드 표시 시 marginHorizontal 16→0, 하단 borderRadius 24→0 애니메이션
 */
export const KeyboardBottomSheet = ({
  isOpen,
  onOpenChange,
  children,
}: KeyboardBottomSheetProps) => {
  const sheetRef = useRef<GorhomBottomSheet>(null);
  const insets = useSafeAreaInsets();
  const keyboardProgress = useSharedValue(0);
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;

  const backgroundStyle = useResolveClassNames('bg-white dark:bg-gray-1');
  const handleIndicatorStyle = useResolveClassNames('bg-gray-4');

  // Sheet open/close
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        sheetRef.current?.expand();
      }, EXPAND_DELAY_MS);
      return () => clearTimeout(timer);
    }
    sheetRef.current?.close();
  }, [isOpen]);

  // 닫기 애니메이션 시작 시 키보드 즉시 dismiss
  const handleAnimate = useCallback((_fromIndex: number, toIndex: number) => {
    if (toIndex === -1) {
      Keyboard.dismiss();
    }
  }, []);

  // 닫기 애니메이션 완료 후 상태 동기화
  const handleSheetChange = useCallback(
    (index: number) => {
      if (index === -1 && isOpenRef.current) {
        isOpenRef.current = false;
        cancelAnimation(keyboardProgress);
        onOpenChange(false);
      }
    },
    [onOpenChange, keyboardProgress],
  );

  // Keyboard margin animation
  useEffect(() => {
    if (!isOpen) {
      cancelAnimation(keyboardProgress);
      const timer = setTimeout(() => {
        keyboardProgress.value = 0;
      }, ANIMATION.duration.normal);
      return () => clearTimeout(timer);
    }
  }, [isOpen, keyboardProgress]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, () => {
      if (!isOpenRef.current) return;
      keyboardProgress.value = withTiming(1, { duration: ANIMATION.duration.normal });
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      if (!isOpenRef.current) return;
      keyboardProgress.value = withTiming(0, { duration: ANIMATION.duration.normal });
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [keyboardProgress]);

  const sheetStyle = useAnimatedStyle(() => ({
    marginHorizontal: interpolate(keyboardProgress.value, [0, 1], [16, 0]),
  }));

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />
    ),
    [],
  );

  return (
    <KeyboardProgressContext.Provider value={keyboardProgress}>
      <GorhomBottomSheet
        ref={sheetRef}
        index={-1}
        enableDynamicSizing
        enablePanDownToClose
        detached
        bottomInset={insets.bottom}
        style={sheetStyle}
        backgroundStyle={backgroundStyle}
        backgroundComponent={SheetBackground}
        handleIndicatorStyle={[styles.handleIndicator, handleIndicatorStyle]}
        backdropComponent={renderBackdrop}
        onAnimate={handleAnimate}
        onChange={handleSheetChange}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustPan"
      >
        <BottomSheetView style={styles.content}>{children}</BottomSheetView>
      </GorhomBottomSheet>
    </KeyboardProgressContext.Provider>
  );
};

const styles = StyleSheet.create({
  handleIndicator: {
    width: 36,
  },
  content: {
    padding: 20,
  },
});
