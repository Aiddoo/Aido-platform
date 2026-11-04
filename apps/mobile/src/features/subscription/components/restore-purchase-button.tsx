import { useIsOnline } from '@src/shared/hooks/use-is-online';
import { useTranslation } from '@src/shared/i18n';
import { TextButton } from '@src/shared/ui';
import { useMutation } from '@tanstack/react-query';
import type { ComponentProps } from 'react';

import { useRestoreMutationOptions } from '../queries/use-restore-mutation-options';

type RestorePurchaseButtonProps = Omit<
  ComponentProps<typeof TextButton>,
  'children' | 'onPress' | 'isDisabled' | 'variant'
>;

/** 이전 구매 복원. 복원 중이거나 오프라인이면 누를 수 없다 */
export function RestorePurchaseButton(props: RestorePurchaseButtonProps) {
  const { t } = useTranslation('subscription');
  const restore = useMutation(useRestoreMutationOptions());
  const isOnline = useIsOnline();

  return (
    <TextButton
      {...props}
      variant="underline"
      onPress={() => restore.mutate()}
      isDisabled={restore.isPending || !isOnline}
    >
      {t('subscriber.restoreButton')}
    </TextButton>
  );
}
