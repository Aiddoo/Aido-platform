import { type ComponentProps, type ReactNode } from 'react';

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

/** 사용자가 닫으면 `dismissValue`, 부른 화면이 사라지면 undefined다. 처음 답 하나만 남는다 */
export function useOpenSheet() {
  const overlay = useOverlay();

  return <T = void,>(
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
    );
}
