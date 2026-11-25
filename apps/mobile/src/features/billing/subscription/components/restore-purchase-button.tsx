import { useIsOnline } from '@src/shared/hooks/use-is-online';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { TextButton } from '@src/shared/ui';
import { useMutation } from '@tanstack/react-query';
import type { ComponentProps } from 'react';

import { useRestoreMutationOptions } from '../queries/subscription.mutations';

type RestorePurchaseButtonProps = Omit<
  ComponentProps<typeof TextButton>,
  'children' | 'isDisabled' | 'variant'
>;

export function RestorePurchaseButton({ onPress, ...props }: RestorePurchaseButtonProps) {
  const { t } = useTranslation('subscription');
  const restore = useMutation(useRestoreMutationOptions());
  const isOnline = useIsOnline();

  // 결제 버튼과 같은 이유로 isPending이 바뀌기 전 같은 프레임의 두 번째 탭을 막는다
  const handleRestore = useSingleTap(() => restore.mutate());

  return (
    <TextButton
      {...props}
      variant="underline"
      onPress={(event) => {
        handleRestore();
        // asChild 트리거·코치마크가 자식에 넣은 onPress를 이어 불러 그 누름이 사라지지 않게 한다
        if (typeof onPress === 'function') {
          onPress(event);
        }
      }}
      isDisabled={restore.isPending || !isOnline}
    >
      {t('subscriber.restoreButton')}
    </TextButton>
  );
}
