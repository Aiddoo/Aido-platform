import { useIsOnline } from '@src/shared/hooks/use-is-online';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { TextButton, useAppToast } from '@src/shared/ui';
import { useMutation } from '@tanstack/react-query';
import type { ComponentProps } from 'react';

import { useOpenSubscriptionInquiry } from '../hooks/use-open-subscription-inquiry';
import { useRestoreMutationOptions } from '../queries/subscription.mutations';
import { toSubscriptionActionFailure } from '../utils/subscription-failure.view-model';

type RestorePurchaseButtonProps = Omit<
  ComponentProps<typeof TextButton>,
  'children' | 'isDisabled' | 'variant'
>;

export function RestorePurchaseButton({ onPress, ...props }: RestorePurchaseButtonProps) {
  const { t } = useTranslation('subscription');
  const restoreMutationOptions = useRestoreMutationOptions();
  const offerRestoreInquiry = useOfferRestoreInquiry();
  const restore = useMutation({
    ...restoreMutationOptions,
    // 문의 토스트는 복원 중 화면을 떠나도 뜨도록 mutate 콜백이 아니라 mutation 단계에서 기록·보고 뒤에 띄운다
    onError: (error, ...rest) => {
      restoreMutationOptions.onError?.(error, ...rest);
      offerRestoreInquiry(error);
    },
  });
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

/** 복원 버튼은 화면에 그대로 남아 다시 누를 수 있으니 토스트에서 문의로만 잇는다 */
function useOfferRestoreInquiry() {
  const { t } = useTranslation(['subscription']);
  const toast = useAppToast();
  const openInquiry = useOpenSubscriptionInquiry();

  return (error: unknown) => {
    const failure = toSubscriptionActionFailure('restore', error);
    if (failure.type !== 'contactSupport') {
      return;
    }
    toast.error(t(failure.titleKey), {
      description: t(failure.descriptionKey),
      action: {
        label: t('subscription:failure.contactSupport'),
        onPress: () => openInquiry(failure),
      },
    });
  };
}
