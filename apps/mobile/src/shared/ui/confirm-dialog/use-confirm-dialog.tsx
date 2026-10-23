import type { ComponentProps, ReactNode } from 'react';
import { useMemo } from 'react';

import { useOverlay } from '../overlay';
import { ConfirmDialog } from './confirm-dialog';

export interface ConfirmDialogOptions {
  title: ReactNode;
  description?: ReactNode;
  confirmLabel: string;
  confirmColor?: ComponentProps<typeof ConfirmDialog.ConfirmButton>['color'];
  /** 생략하면 확인 버튼만 오른쪽에 보여 준다. */
  cancelLabel?: string;
}

/** 확인 다이얼로그를 띄우고 사용자가 확인했는지 돌려준다. 닫기·취소는 false다. */
export function useConfirmDialog() {
  const overlay = useOverlay();

  return useMemo(
    () => ({
      open: ({
        title,
        description,
        confirmLabel,
        confirmColor,
        cancelLabel,
      }: ConfirmDialogOptions) =>
        overlay.open<boolean>(({ isOpen, close, exit }) => {
          const finish = (isConfirmed: boolean) => {
            close(isConfirmed);
            exit();
          };

          return (
            <ConfirmDialog
              isOpen={isOpen}
              onOpenChange={(open) => {
                if (!open) {
                  finish(false);
                }
              }}
              title={<ConfirmDialog.Title>{title}</ConfirmDialog.Title>}
              description={
                description == null ? undefined : (
                  <ConfirmDialog.Description>{description}</ConfirmDialog.Description>
                )
              }
              cancelButton={
                cancelLabel == null ? undefined : (
                  <ConfirmDialog.CancelButton onPress={() => finish(false)}>
                    {cancelLabel}
                  </ConfirmDialog.CancelButton>
                )
              }
              confirmButton={
                <ConfirmDialog.ConfirmButton color={confirmColor} onPress={() => finish(true)}>
                  {confirmLabel}
                </ConfirmDialog.ConfirmButton>
              }
            />
          );
        }),
    }),
    [overlay],
  );
}
