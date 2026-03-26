import { ANIMATION } from '@src/shared/constants/animation.constants';
import { type ReactNode, useCallback, useEffect, useRef } from 'react';
import {
  Dimensions,
  Modal,
  Platform,
  Pressable,
  StatusBar,
  useWindowDimensions,
  View,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useResolveClassNames } from 'uniwind';
import { MIN_CONTENT_HEIGHT, sharedSheetStyles, TOP_MARGIN } from './constants';

/**
 * Android Modal(statusBarTranslucent)은 네비게이션 바 뒤까지 확장되어
 * SafeAreaInsets로 bottom을 잡을 수 없다. screen - window - statusBar로 직접 계산.
 */
const getAndroidNavBarHeight = () => {
  if (Platform.OS !== 'android') return 0;
  const screenHeight = Dimensions.get('screen').height;
  const windowHeight = Dimensions.get('window').height;
  const statusBarHeight = StatusBar.currentHeight ?? 0;
  return Math.max(0, screenHeight - windowHeight - statusBarHeight);
};

const DISMISS_DISPLACEMENT = 100;
const DISMISS_VELOCITY = 500;

interface ModalBottomSheetProps {
  isOpen: boolean;
  /** 닫기 시작 (backdrop tap, swipe) → 부모가 isOpen을 false로 전환 */
  onClose: () => void;
  /** 닫기 애니메이션 완료 후 호출 → 컴포넌트 언마운트 트리거 */
  onExit: () => void;
  children: ReactNode;
}

export const ModalBottomSheet = ({ isOpen, onClose, onExit, children }: ModalBottomSheetProps) => {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const backgroundStyle = useResolveClassNames('bg-white dark:bg-gray-1');
  const handleIndicatorStyle = useResolveClassNames('bg-gray-4');

  const androidNavBar = getAndroidNavBarHeight();
  const bottomInset = Math.max(insets.bottom, androidNavBar) + 16;
  const maxHeight = Math.max(MIN_CONTENT_HEIGHT, windowHeight - insets.top - TOP_MARGIN);

  // Refs for callbacks — inline 함수가 매 렌더마다 바뀌어도 애니메이션이 리셋되지 않도록
  const onCloseRef = useRef(onClose);
  const onExitRef = useRef(onExit);
  onCloseRef.current = onClose;
  onExitRef.current = onExit;

  // Animation shared values
  const translateY = useSharedValue(windowHeight);
  const backdropOpacity = useSharedValue(0);
  const dragY = useSharedValue(0);
  const isAnimatingOut = useSharedValue(false);

  // Ref 기반 콜백 래퍼 — deps 안정화 (빈 deps로 참조 안정)
  const callOnExit = useCallback(() => {
    onExitRef.current();
  }, []);

  const callOnClose = useCallback(() => {
    onCloseRef.current();
  }, []);

  // isOpen 전환 처리
  useEffect(() => {
    if (isOpen) {
      // Animate in
      isAnimatingOut.value = false;
      dragY.value = 0;
      translateY.value = withTiming(0, { duration: ANIMATION.duration.slow });
      backdropOpacity.value = withTiming(0.5, { duration: ANIMATION.duration.slow });
    } else {
      // Animate out (한 번만 실행)
      if (!isAnimatingOut.value) {
        isAnimatingOut.value = true;
        translateY.value = withTiming(
          windowHeight,
          { duration: ANIMATION.duration.slow },
          (finished) => {
            if (finished) {
              runOnJS(callOnExit)();
            }
          },
        );
        backdropOpacity.value = withTiming(0, { duration: ANIMATION.duration.slow });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refs로 콜백 안정화, windowHeight는 초기값만 필요
  }, [isOpen, backdropOpacity, callOnExit, dragY, isAnimatingOut, translateY, windowHeight]);

  // Pan gesture for swipe-to-dismiss
  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      if (event.translationY > 0) {
        dragY.value = event.translationY;
      }
    })
    .onEnd((event) => {
      if (event.translationY > DISMISS_DISPLACEMENT || event.velocityY > DISMISS_VELOCITY) {
        // dismiss — dragY를 유지한 채로 닫기 (올라갔다 내려가는 현상 방지)
        runOnJS(callOnClose)();
      } else {
        // snap back
        dragY.value = withTiming(0, { duration: ANIMATION.duration.normal });
      }
    });

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value + dragY.value }],
  }));

  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent>
      <GestureHandlerRootView className="flex-1">
        {/* Backdrop */}
        <Pressable className="absolute inset-0" onPress={callOnClose}>
          <Animated.View className="absolute inset-0 bg-black" style={backdropAnimatedStyle} />
        </Pressable>

        {/* Sheet */}
        <GestureDetector gesture={panGesture}>
          <Animated.View
            style={[
              sharedSheetStyles.detached,
              { position: 'absolute', left: 0, right: 0, bottom: bottomInset, maxHeight },
              sheetAnimatedStyle,
            ]}
          >
            <View
              style={[
                sharedSheetStyles.detachedBackground,
                backgroundStyle,
                { overflow: 'hidden' },
              ]}
            >
              {/* Handle */}
              <View className="items-center pt-2 pb-1">
                <View
                  style={[
                    sharedSheetStyles.handleIndicator,
                    handleIndicatorStyle,
                    { height: 4, borderRadius: 2 },
                  ]}
                />
              </View>

              {/* Content */}
              <View style={sharedSheetStyles.content}>{children}</View>
            </View>
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
};
