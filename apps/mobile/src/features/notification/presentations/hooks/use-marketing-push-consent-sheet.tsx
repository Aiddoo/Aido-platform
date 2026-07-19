import { useUpdateMarketingPushConsentMutationOptions } from '@src/features/auth/presentations/queries/use-update-marketing-push-consent-mutation-options';
import { useTranslation } from '@src/shared/i18n';
import { ConfirmDialog, useOverlay } from '@src/shared/ui';
import { useMutation } from '@tanstack/react-query';
import { useRef } from 'react';

interface MarketingPushConsentDialogProps {
  isOpen: boolean;
  onAgree: () => void;
  onDismiss: () => void;
}

/**
 * 광고성 앱 푸시 수신 동의 시트.
 *
 * 수신 내용·철회 방법·법정 표기를 명시한 뒤 명시적으로 동의받는다(정보통신망법 opt-in).
 * "동의"는 서버에 실제 동의 시점(NOW())을 기록하는 기존 mutation을 호출한다.
 */
function MarketingPushConsentDialog({
  isOpen,
  onAgree,
  onDismiss,
}: MarketingPushConsentDialogProps) {
  const { t } = useTranslation('notification');
  const mutation = useMutation(useUpdateMarketingPushConsentMutationOptions());
  const settledRef = useRef(false);

  const settle = (action: () => void) => {
    if (settledRef.current) {
      return;
    }
    settledRef.current = true;
    action();
  };

  const handleAgree = () => {
    settle(() => {
      mutation.mutate({ agreed: true });
      onAgree();
    });
  };

  const handleDismiss = () => {
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
        <ConfirmDialog.CancelButton onPress={handleDismiss}>
          {t('marketingOptIn.later')}
        </ConfirmDialog.CancelButton>
      }
      confirmButton={
        <ConfirmDialog.ConfirmButton onPress={handleAgree}>
          {t('marketingOptIn.agree')}
        </ConfirmDialog.ConfirmButton>
      }
    />
  );
}

interface OpenOptions {
  onAgree?: () => void;
  onDismiss?: () => void;
}

/** 명령형으로 마케팅 푸시 동의 시트를 여는 훅 (usePremiumDialog 패턴) */
export function useMarketingPushConsentSheet() {
  const overlay = useOverlay();

  return {
    open: (options?: OpenOptions) => {
      overlay.open(({ isOpen, close, exit }) => (
        <MarketingPushConsentDialog
          isOpen={isOpen}
          onAgree={() => {
            options?.onAgree?.();
            close();
            exit();
          }}
          onDismiss={() => {
            options?.onDismiss?.();
            close();
            exit();
          }}
        />
      ));
    },
  };
}
