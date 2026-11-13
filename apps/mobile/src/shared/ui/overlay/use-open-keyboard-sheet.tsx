import { type ReactNode, useCallback } from 'react';

import { useOverlay } from './use-overlay';

interface KeyboardSheetControl {
  isOpen: boolean;
  /** `false`가 오면 트리에서 지운다. 시트가 닫힘 애니메이션 뒤에 보내고, 보낸 뒤처럼 바로 지울 때도 쓴다 */
  onOpenChange: (isOpen: boolean) => void;
  close: () => void;
}

/** 폼이 `footer`를 가져 `KeyboardBottomSheet`를 스스로 그리는 내용을 띄운다. route 문맥이 없는 입력 시트(친구 할 일 콕, 계획 고치기)다 */
export function useOpenKeyboardSheet() {
  const overlay = useOverlay();

  return useCallback(
    (render: (sheet: KeyboardSheetControl) => ReactNode) => {
      overlay.open(({ isOpen, close, unmount }) =>
        render({
          isOpen,
          onOpenChange: (nextIsOpen) => {
            if (!nextIsOpen) {
              close();
              unmount();
            }
          },
          close,
        }),
      );
    },
    [overlay],
  );
}
