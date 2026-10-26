import type { ReactNode } from 'react';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  cancelButton?: ReactNode;
  confirmButton: ReactNode;
  /** 확인 버튼 아래에 두는 두 번째 행동. 있으면 버튼을 모두 세로로 쌓는다 */
  secondaryButton?: ReactNode;
}
