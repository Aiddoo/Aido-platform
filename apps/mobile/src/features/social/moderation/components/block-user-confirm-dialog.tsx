import { useRouteParams } from '@src/shared/hooks/use-route-params';
import { useTranslation } from '@src/shared/i18n';
import { ConfirmDialog, useSheetRoute } from '@src/shared/ui';
import { useMutation } from '@tanstack/react-query';

import { useBlockUserMutationOptions } from '../queries/moderation.mutations';
import { blockUserParamsSchema } from '../schemas/moderation-params.schema';

/** 차단 확인. 차단하는 동안 다이얼로그를 남기고, 실패하면 mutation이 토스트로 한 번 알린 뒤 다시 누를 수 있다 */
export function BlockUserConfirmDialog() {
  const { t } = useTranslation(['moderation', 'common']);
  const [{ userId, name }] = useRouteParams(blockUserParamsSchema);
  const dialog = useSheetRoute('/feed');
  const blockUser = useMutation(useBlockUserMutationOptions());

  return (
    <ConfirmDialog
      isOpen={dialog.isOpen}
      title={t('block.confirmTitle', { name })}
      description={t('block.confirmDescription')}
      cancelLabel={t('common:actions.cancel')}
      confirmLabel={t('block.confirm')}
      confirmColor="danger"
      confirmTestID="block-user-confirm"
      onConfirm={() => blockUser.mutateAsync({ userId, displayName: name })}
      onFinish={() => dialog.exit()}
    />
  );
}
