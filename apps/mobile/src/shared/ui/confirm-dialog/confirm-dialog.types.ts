import type { ReactNode } from 'react';

import type { ButtonProps } from '../button/button.types';

export interface ConfirmDialogOptions {
  title: ReactNode;
  description?: ReactNode;
  confirmLabel: string;
  confirmColor?: ButtonProps['color'];
  /** 생략하면 확인 버튼만 오른쪽에 보여 준다 */
  cancelLabel?: string;
  /** E2E(Maestro)가 확인 버튼을 찾는 testID */
  confirmTestID?: string;
  /** 지울 수 없는 대상처럼 안내만 하고 확인을 막을 때 */
  isConfirmDisabled?: boolean;
  /** 도는 동안 다이얼로그를 닫을 수 없고, 던지면 남겨 다시 누를 수 있다. 실패 토스트는 `meta.errorFeedback`이 띄운다 */
  onConfirm?: () => unknown;
}

export interface ConfirmDialogProps extends ConfirmDialogOptions {
  isOpen: boolean;
  /** 확인이 끝나면 true, 취소·바깥 탭·뒤로 가기는 false */
  onFinish: (isConfirmed: boolean) => void;
}
