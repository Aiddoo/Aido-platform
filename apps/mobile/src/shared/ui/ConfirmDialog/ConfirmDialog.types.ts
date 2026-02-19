import type { ReactNode } from 'react';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  cancelButton?: ReactNode;
  confirmButton: ReactNode;
}
