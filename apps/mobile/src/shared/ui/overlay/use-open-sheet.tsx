import { type ComponentProps, type ReactNode, useCallback } from 'react';

import { ModalBottomSheet } from '../bottom-sheet/modal-bottom-sheet';
import { useOverlay } from './use-overlay';

export type OpenSheetOptions = Pick<
  ComponentProps<typeof ModalBottomSheet>,
  'hasFixedHeader' | 'onCloseStart'
>;

/**
 * route 문맥이 없는 시트(폼에 묶인 피커)를 띄운다. 내용은 고른 값을 `close(value)`로 돌려주고,
 * 값 없이 닫히면(끌어 내림, 취소, 부른 화면이 사라짐) Promise는 undefined다
 */
export function useOpenSheet() {
  const overlay = useOverlay();

  return useCallback(
    <T = void,>(
      render: (close: (value?: T) => void) => ReactNode,
      options: OpenSheetOptions = {},
    ): Promise<T | undefined> =>
      overlay.openAsync<T | undefined>(
        ({ isOpen, close, unmount }) => (
          <ModalBottomSheet
            {...options}
            isOpen={isOpen}
            onOpenChange={() => close(undefined)}
            onExit={unmount}
          >
            {render(close)}
          </ModalBottomSheet>
        ),
        { dismissedValue: undefined },
      ),
    [overlay],
  );
}
