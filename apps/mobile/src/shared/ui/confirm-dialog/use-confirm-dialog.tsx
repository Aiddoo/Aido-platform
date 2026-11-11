import type { ComponentProps, ReactNode } from 'react';
import { useMemo, useState } from 'react';

import { useOverlay } from '../overlay';
import { ConfirmDialog } from './confirm-dialog';

export interface ConfirmDialogOptions {
  title: ReactNode;
  description?: ReactNode;
  confirmLabel: string;
  confirmColor?: ComponentProps<typeof ConfirmDialog.ConfirmButton>['color'];
  /** 생략하면 확인 버튼만 오른쪽에 보여 준다. */
  cancelLabel?: string;
  /** E2E(Maestro)가 확인 버튼을 찾는 testID */
  confirmTestID?: string;
  /**
   * 확인을 누르면 다이얼로그를 연 채 실행하고 끝나면 닫는다. 도는 동안 확인 버튼이 진행 중이고 닫을 수 없다.
   * 던지면 닫고 false다. 실패 안내는 호출부 mutation의 `meta.errorFeedback`이 맡는다.
   */
  onConfirm?: () => unknown;
}

/** 확인 다이얼로그를 띄우고 사용자가 확인했는지 돌려준다. 닫기·취소, 답 없이 사라짐은 false다. */
export function useConfirmDialog() {
  const overlay = useOverlay();

  return useMemo(
    () => ({
      openAsync: (options: ConfirmDialogOptions) =>
        overlay.openAsync<boolean>(
          ({ isOpen, close, unmount }) => (
            <ConfirmDialogContent
              {...options}
              isOpen={isOpen}
              onFinish={(isConfirmed) => {
                close(isConfirmed);
                unmount();
              }}
            />
          ),
          { dismissedValue: false },
        ),
    }),
    [overlay],
  );
}

interface ConfirmDialogContentProps extends ConfirmDialogOptions {
  isOpen: boolean;
  onFinish: (isConfirmed: boolean) => void;
}

/** 열 때의 화면이 굳으므로 진행 상태는 이 컴포넌트가 스스로 갖는다 */
function ConfirmDialogContent({
  title,
  description,
  confirmLabel,
  confirmColor,
  cancelLabel,
  confirmTestID,
  onConfirm,
  isOpen,
  onFinish,
}: ConfirmDialogContentProps) {
  const [isConfirming, setIsConfirming] = useState(false);

  const handleConfirm = async () => {
    if (onConfirm == null) {
      onFinish(true);
      return;
    }
    setIsConfirming(true);
    try {
      await onConfirm();
      onFinish(true);
    } catch {
      onFinish(false);
    }
  };

  return (
    <ConfirmDialog
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open && !isConfirming) {
          onFinish(false);
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
          <ConfirmDialog.CancelButton isDisabled={isConfirming} onPress={() => onFinish(false)}>
            {cancelLabel}
          </ConfirmDialog.CancelButton>
        )
      }
      confirmButton={
        <ConfirmDialog.ConfirmButton
          testID={confirmTestID}
          color={confirmColor}
          isLoading={isConfirming}
          onPress={handleConfirm}
        >
          {confirmLabel}
        </ConfirmDialog.ConfirmButton>
      }
    />
  );
}
