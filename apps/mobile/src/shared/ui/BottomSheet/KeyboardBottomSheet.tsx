import GorhomBottomSheet, {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { type ReactNode, useCallback, useEffect } from 'react';
import { Keyboard, StyleSheet, useWindowDimensions } from 'react-native';
import { useKeyboardContext } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useResolveClassNames } from 'uniwind';

const SHEET_INDEX = {
  CLOSED: -1,
  OPEN: 0,
} as const;

const MIN_CONTENT_HEIGHT = 280;
const TOP_MARGIN = 24;

interface KeyboardBottomSheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  children: ReactNode;
}

/**
 * 키보드 연동 BottomSheet.
 */
export const KeyboardBottomSheet = ({
  isOpen,
  onOpenChange,
  children,
}: KeyboardBottomSheetProps) => {
  const { setEnabled } = useKeyboardContext();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const backgroundStyle = useResolveClassNames('bg-white dark:bg-gray-1');
  const handleIndicatorStyle = useResolveClassNames('bg-gray-4');
  const maxDynamicContentSize = Math.max(
    MIN_CONTENT_HEIGHT,
    windowHeight - insets.top - TOP_MARGIN,
  );

  useEffect(() => {
    setEnabled(!isOpen);
    return () => setEnabled(true);
  }, [isOpen, setEnabled]);

  const handleAnimate = useCallback((_fromIndex: number, toIndex: number) => {
    if (toIndex === SHEET_INDEX.CLOSED) {
      Keyboard.dismiss();
    }
  }, []);

  const handleSheetChange = useCallback(
    (index: number) => {
      if (index === SHEET_INDEX.CLOSED && isOpen) {
        onOpenChange(false);
      }
    },
    [isOpen, onOpenChange],
  );

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={SHEET_INDEX.CLOSED}
        appearsOnIndex={SHEET_INDEX.OPEN}
        opacity={0.5}
      />
    ),
    [],
  );

  return (
    <GorhomBottomSheet
      index={isOpen ? SHEET_INDEX.OPEN : SHEET_INDEX.CLOSED}
      enableDynamicSizing
      maxDynamicContentSize={maxDynamicContentSize}
      enablePanDownToClose
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      enableBlurKeyboardOnGesture
      android_keyboardInputMode="adjustPan"
      topInset={insets.top}
      backgroundStyle={backgroundStyle}
      handleIndicatorStyle={[styles.handleIndicator, handleIndicatorStyle]}
      backdropComponent={renderBackdrop}
      onAnimate={handleAnimate}
      onChange={handleSheetChange}
    >
      <BottomSheetView style={[styles.content, { paddingBottom: insets.bottom }]}>
        {children}
      </BottomSheetView>
    </GorhomBottomSheet>
  );
};

const styles = StyleSheet.create({
  handleIndicator: {
    width: 36,
  },
  content: {
    paddingTop: 20,
    paddingHorizontal: 20,
  },
});
