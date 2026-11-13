import { useMemo } from 'react';

import { useOverlay } from '../overlay/use-overlay';
import { ConfirmDialog } from './confirm-dialog';
import type { ConfirmDialogOptions } from './confirm-dialog.types';

/** 확인 다이얼로그를 띄우고 사용자가 확인했는지 돌려준다. 닫기·취소, 답 없이 사라짐은 false다 */
export function useConfirmDialog() {
  const overlay = useOverlay();

  return useMemo(
    () => ({
      openAsync: (options: ConfirmDialogOptions) =>
        overlay.openAsync<boolean>(
          ({ isOpen, close, unmount }) => (
            <ConfirmDialog
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
