import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { type ReactNode, type RefObject, useCallback } from 'react';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useResolveClassNames } from 'uniwind';

import { FAST_DISMISS, MIN_CONTENT_HEIGHT, sharedSheetStyles, TOP_MARGIN } from './constants';

interface StackedBottomSheetModalProps {
  modalRef: RefObject<BottomSheetModal | null>;
  onDismiss?: () => void;
  onChange?: (index: number) => void;
  children: ReactNode;
}

/**
 * 다른 시트 위에 스택되는 피커/서브화면용 BottomSheetModal.
 */
export const StackedBottomSheetModal = ({
  modalRef,
  onDismiss,
  onChange,
  children,
}: StackedBottomSheetModalProps) => {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const backgroundStyle = useResolveClassNames('bg-white dark:bg-gray-1');
  const handleIndicatorStyle = useResolveClassNames('bg-gray-4');
  const maxDynamicContentSize = Math.max(
    MIN_CONTENT_HEIGHT,
    windowHeight - insets.top - TOP_MARGIN,
  );

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
        pressBehavior={'override' as 'none'}
        onPress={() => modalRef.current?.dismiss(FAST_DISMISS)}
      />
    ),
    [modalRef],
  );

  return (
    <BottomSheetModal
      ref={modalRef}
      stackBehavior="push"
      enableDynamicSizing
      maxDynamicContentSize={maxDynamicContentSize}
      enablePanDownToClose
      detached
      bottomInset={insets.bottom || 16}
      style={sharedSheetStyles.detached}
      backgroundStyle={[backgroundStyle, sharedSheetStyles.detachedBackground]}
      handleIndicatorStyle={[sharedSheetStyles.handleIndicator, handleIndicatorStyle]}
      backdropComponent={renderBackdrop}
      onDismiss={onDismiss}
      onChange={onChange}
    >
      <BottomSheetView style={sharedSheetStyles.content}>{children}</BottomSheetView>
    </BottomSheetModal>
  );
};
