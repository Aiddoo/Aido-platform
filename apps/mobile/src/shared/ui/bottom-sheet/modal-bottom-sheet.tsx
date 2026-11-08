import { type ComponentProps, useEffect } from 'react';
import { Keyboard } from 'react-native';

import { BottomSheet } from './bottom-sheet';

interface ModalBottomSheetProps extends Omit<ComponentProps<typeof BottomSheet>, 'onOpenChange'> {
  /** 닫기가 시작되는 순간 불린다. overlay는 여기서 값을 돌려준다 */
  onOpenChange: (isOpen: boolean) => void;
  /** 닫기 애니메이션이 끝난 뒤 불린다. overlay는 여기서 내용을 지운다 */
  onExit: () => void;
}

/** 키보드는 아래 시트의 것이라 열릴 때 내린다 */
export function ModalBottomSheet({
  isOpen,
  onOpenChange,
  onCloseStart,
  onExit,
  ...sheetProps
}: ModalBottomSheetProps) {
  useEffect(() => {
    if (isOpen) {
      Keyboard.dismiss();
    }
  }, [isOpen]);

  return (
    <BottomSheet
      {...sheetProps}
      isOpen={isOpen}
      onCloseStart={() => {
        onCloseStart?.();
        onOpenChange(false);
      }}
      onOpenChange={onExit}
    />
  );
}
