import GorhomBottomSheet, {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { type ComponentRef, type ReactNode, useCallback, useEffect, useRef } from 'react';
import { type LayoutChangeEvent, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useResolveClassNames } from 'uniwind';
import { MIN_CONTENT_HEIGHT, SHEET_INDEX, sharedSheetStyles, TOP_MARGIN } from './constants';

interface BottomSheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onCloseStart?: () => void;
  children: ReactNode;
}

/**
 * 키보드 불필요 BottomSheet. 피커, 액션시트 등에 사용.
 */
export const BottomSheet = ({ isOpen, onOpenChange, onCloseStart, children }: BottomSheetProps) => {
  const sheetRef = useRef<ComponentRef<typeof GorhomBottomSheet> | null>(null);
  const lastContentHeightRef = useRef(0);
  const isClosingRef = useRef(false);
  const hasNotifiedCloseRef = useRef(false);
  const prevIsOpenRef = useRef(isOpen);
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const backgroundStyle = useResolveClassNames('bg-white dark:bg-gray-1');
  const handleIndicatorStyle = useResolveClassNames('bg-gray-4');
  const maxDynamicContentSize = Math.max(
    MIN_CONTENT_HEIGHT,
    windowHeight - insets.top - TOP_MARGIN,
  );

  useEffect(() => {
    if (!isOpen) {
      lastContentHeightRef.current = 0;
    }
  }, [isOpen]);

  useEffect(() => {
    const wasOpen = prevIsOpenRef.current;
    prevIsOpenRef.current = isOpen;

    if (!sheetRef.current || wasOpen === isOpen) {
      return;
    }

    if (isOpen) {
      isClosingRef.current = false;
      hasNotifiedCloseRef.current = false;
      requestAnimationFrame(() => {
        sheetRef.current?.snapToIndex(SHEET_INDEX.OPEN);
      });
      return;
    }

    isClosingRef.current = true;
    hasNotifiedCloseRef.current = false;
    requestAnimationFrame(() => {
      sheetRef.current?.close();
    });
  }, [isOpen]);

  const handleAnimate = (_fromIndex: number, toIndex: number) => {
    if (toIndex === SHEET_INDEX.CLOSED) {
      isClosingRef.current = true;
      onCloseStart?.();
    }
  };

  const handleSheetChange = (index: number) => {
    if (index === SHEET_INDEX.CLOSED) {
      if (!hasNotifiedCloseRef.current) {
        hasNotifiedCloseRef.current = true;
        onOpenChange(false);
      }
      isClosingRef.current = false;
      return;
    }

    hasNotifiedCloseRef.current = false;
    isClosingRef.current = false;
  };

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={SHEET_INDEX.CLOSED}
        appearsOnIndex={SHEET_INDEX.OPEN}
        opacity={0.5}
        pressBehavior="close"
      />
    ),
    [],
  );

  const handleContentLayout = (event: LayoutChangeEvent) => {
    if (!isOpen || isClosingRef.current) {
      return;
    }

    const nextHeight = Math.round(event.nativeEvent.layout.height);
    const prevHeight = lastContentHeightRef.current;

    if (Math.abs(nextHeight - prevHeight) < 2) {
      return;
    }

    lastContentHeightRef.current = nextHeight;
    requestAnimationFrame(() => {
      sheetRef.current?.snapToIndex(SHEET_INDEX.OPEN);
    });
  };

  return (
    <GorhomBottomSheet
      ref={sheetRef}
      index={isOpen ? SHEET_INDEX.OPEN : SHEET_INDEX.CLOSED}
      enableDynamicSizing
      maxDynamicContentSize={maxDynamicContentSize}
      enablePanDownToClose
      detached
      bottomInset={insets.bottom || 16}
      style={sharedSheetStyles.detached}
      backgroundStyle={[backgroundStyle, sharedSheetStyles.detachedBackground]}
      handleIndicatorStyle={[sharedSheetStyles.handleIndicator, handleIndicatorStyle]}
      backdropComponent={renderBackdrop}
      onAnimate={handleAnimate}
      onChange={handleSheetChange}
    >
      <BottomSheetView onLayout={handleContentLayout} style={sharedSheetStyles.content}>
        {children}
      </BottomSheetView>
    </GorhomBottomSheet>
  );
};
