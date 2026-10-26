import { TODO_SHEET_FALLBACK_HREF } from '@src/features/todo/utils/navigation/todo-sheet-href';
import { useTranslation } from '@src/shared/i18n';
import { ConfirmDialog, useSheetRoute } from '@src/shared/ui';
import { useMutation } from '@tanstack/react-query';

import { useBlockUserRouteParams } from '../hooks/use-block-user-route-params';
import { useBlockUserMutationOptions } from '../queries/use-block-user-mutation-options';

/**
 * 차단 확인. 차단하는 동안 다이얼로그를 그대로 두고 확인 버튼만 불러오는 중으로 바꾼다.
 * 끝나면(성공·실패 모두) 닫고, 결과 안내는 mutation이 토스트로 한 번 띄운다.
 */
export function BlockUserConfirmDialog() {
  const { t } = useTranslation(['moderation', 'common']);
  const { userId, name } = useBlockUserRouteParams();
  const dialog = useSheetRoute(TODO_SHEET_FALLBACK_HREF);
  const blockUser = useMutation(useBlockUserMutationOptions());

  return (
    <ConfirmDialog
      isOpen={dialog.isOpen}
      onOpenChange={(isOpen) => {
        if (!isOpen && !blockUser.isPending) {
          dialog.onOpenChange(false);
        }
      }}
      title={<ConfirmDialog.Title>{t('block.confirmTitle', { name })}</ConfirmDialog.Title>}
      description={
        <ConfirmDialog.Description>{t('block.confirmDescription')}</ConfirmDialog.Description>
      }
      cancelButton={
        <ConfirmDialog.CancelButton
          isDisabled={blockUser.isPending}
          onPress={() => dialog.onOpenChange(false)}
        >
          {t('common:actions.cancel')}
        </ConfirmDialog.CancelButton>
      }
      confirmButton={
        <ConfirmDialog.ConfirmButton
          testID="block-user-confirm"
          color="danger"
          isLoading={blockUser.isPending}
          onPress={() =>
            blockUser.mutate(
              { userId, displayName: name },
              { onSettled: () => dialog.onOpenChange(false) },
            )
          }
        >
          {t('block.confirm')}
        </ConfirmDialog.ConfirmButton>
      }
    />
  );
}
