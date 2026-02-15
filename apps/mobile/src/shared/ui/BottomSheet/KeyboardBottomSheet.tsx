import GorhomBottomSheet, {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, ScrollView, StyleSheet } from 'react-native';
import { useResolveClassNames } from 'uniwind';

interface KeyboardBottomSheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  children: ReactNode;
}

const EXPAND_DELAY_MS = 100;

/**
 * 키보드 연동 BottomSheet.
 *
 * Keyboard.addListener로 키보드 높이를 추적하고,
 * paddingBottom으로 콘텐츠를 키보드 위에 배치함.
 */
export const KeyboardBottomSheet = ({
  isOpen,
  onOpenChange,
  children,
}: KeyboardBottomSheetProps) => {
  const sheetRef = useRef<GorhomBottomSheet>(null);
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const backgroundStyle = useResolveClassNames('bg-white dark:bg-gray-1');
  const handleIndicatorStyle = useResolveClassNames('bg-gray-4');

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        sheetRef.current?.expand();
      }, EXPAND_DELAY_MS);
      return () => clearTimeout(timer);
    }
    sheetRef.current?.close();
  }, [isOpen]);

  const handleAnimate = useCallback((_fromIndex: number, toIndex: number) => {
    if (toIndex === -1) {
      Keyboard.dismiss();
    }
  }, []);

  const handleSheetChange = useCallback(
    (index: number) => {
      if (index === -1 && isOpenRef.current) {
        isOpenRef.current = false;
        onOpenChange(false);
      }
    },
    [onOpenChange],
  );

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />
    ),
    [],
  );

  return (
    <GorhomBottomSheet
      ref={sheetRef}
      index={-1}
      enableDynamicSizing
      enablePanDownToClose
      backgroundStyle={backgroundStyle}
      handleIndicatorStyle={[styles.handleIndicator, handleIndicatorStyle]}
      backdropComponent={renderBackdrop}
      onAnimate={handleAnimate}
      onChange={handleSheetChange}
    >
      <BottomSheetView style={[styles.content, { paddingBottom: keyboardHeight || 20 }]}>
        <ScrollView keyboardShouldPersistTaps="always" scrollEnabled={false} bounces={false}>
          {children}
        </ScrollView>
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
