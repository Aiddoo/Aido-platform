import { useUpdateMarketingPushConsentMutationOptions } from '@src/features/identity/consent/queries/consent.mutations';
import { useTranslation } from '@src/shared/i18n';
import { ConfirmDialog } from '@src/shared/ui';
import { useMutation } from '@tanstack/react-query';
import { useRef } from 'react';

interface MarketingPushConsentDialogProps {
  isOpen: boolean;
  onAgree: () => void;
  onDismiss: () => void;
}

// 정보통신망법 opt-in이라 서버 동의 기록이 성공한 뒤에만 닫아 실패가 조용히 롤백되지 않게 한다
export function MarketingPushConsentDialog({
  isOpen,
  onAgree,
  onDismiss,
}: MarketingPushConsentDialogProps) {
  const { t } = useTranslation('notification');
  const mutation = useMutation(useUpdateMarketingPushConsentMutationOptions());
  const hasSettledRef = useRef(false);

  const settle = (action: () => void) => {
    if (hasSettledRef.current) {
      return;
    }
    hasSettledRef.current = true;
    action();
  };

  const handleAgree = () => {
    if (mutation.isPending) {
      return;
    }
    mutation.mutate({ agreed: true }, { onSuccess: () => settle(onAgree) });
  };

  const handleDismiss = () => {
    // 동의 처리 중에는 닫기(백드롭 포함)를 막아 롤백 혼란·중복 제출을 방지
    if (mutation.isPending) {
      return;
    }
    settle(onDismiss);
  };

  return (
    <ConfirmDialog
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          handleDismiss();
        }
      }}
      title={<ConfirmDialog.Title>{t('marketingOptIn.title')}</ConfirmDialog.Title>}
      description={
        <ConfirmDialog.Description>{t('marketingOptIn.description')}</ConfirmDialog.Description>
      }
      cancelButton={
        <ConfirmDialog.CancelButton onPress={handleDismiss} isDisabled={mutation.isPending}>
          {t('marketingOptIn.later')}
        </ConfirmDialog.CancelButton>
      }
      confirmButton={
        <ConfirmDialog.ConfirmButton onPress={handleAgree} isLoading={mutation.isPending}>
          {t('marketingOptIn.agree')}
        </ConfirmDialog.ConfirmButton>
      }
    />
  );
}
