import { type ComponentProps, type ReactNode, useCallback } from 'react';

import { ModalBottomSheet } from '../bottom-sheet/modal-bottom-sheet';
import { useOverlay } from './use-overlay';

export type OpenSheetOptions = Pick<
  ComponentProps<typeof ModalBottomSheet>,
  'hasFixedHeader' | 'onCloseStart'
>;

interface OpenSheetAnswerOptions<T> extends OpenSheetOptions {
  /** 스크롤돼도 시트 아래에 고정되는 주 동작 버튼. 내용처럼 `close(value)`로 답한다 */
  footer?: (close: (value?: T) => void) => ReactNode;
  /** 끌어 내림·바깥 누름·뒤로 가기로 닫았을 때의 답. 없으면 부른 화면이 사라졌을 때처럼 undefined다 */
  dismissValue?: T;
}

/**
 * route 문맥이 없는 시트(폼에 묶인 피커, 답을 받아 흐름을 잇는 안내)를 띄운다. 내용·footer는 `close(value)`로 답하고,
 * 사용자가 닫으면 `dismissValue`, 부른 화면이 사라지면 undefined다. 처음 답 하나만 남는다
 */
export function useOpenSheet() {
  const overlay = useOverlay();

  return useCallback(
    <T = void,>(
      render: (close: (value?: T) => void) => ReactNode,
      { footer, dismissValue, ...sheetOptions }: OpenSheetAnswerOptions<T> = {},
    ): Promise<T | undefined> =>
      overlay.openAsync<T | undefined>(
        ({ isOpen, close, unmount }) => (
          <ModalBottomSheet
            {...sheetOptions}
            isOpen={isOpen}
            onOpenChange={() => close(dismissValue)}
            onExit={unmount}
            footer={footer?.(close)}
          >
            {render(close)}
          </ModalBottomSheet>
        ),
        { dismissedValue: undefined },
      ),
    [overlay],
  );
}
