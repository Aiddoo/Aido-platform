import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { ConfirmDialog } from '@src/shared/ui/confirm-dialog';
import { useOverlay } from '@src/shared/ui/overlay';
import { router } from 'expo-router';
import { useMemo } from 'react';

import type { PremiumDialogProps } from './premium-dialog.types';

export function PremiumDialog({
  isOpen,
  onOpenChange,
  title,
  description,
  onConfirm,
}: PremiumDialogProps) {
  const navigate = useSingleTap(router.navigate);

  const { t } = useTranslation();

  const handleSubscribe = () => {
    onOpenChange(false);
    onConfirm?.();
    navigate('/settings/subscription');
  };

  return (
    <ConfirmDialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={<ConfirmDialog.Title>{title ?? t('premiumDialog.title')}</ConfirmDialog.Title>}
      description={<ConfirmDialog.Description>{description}</ConfirmDialog.Description>}
      cancelButton={
        <ConfirmDialog.CancelButton onPress={() => onOpenChange(false)}>
          {t('premiumDialog.close')}
        </ConfirmDialog.CancelButton>
      }
      confirmButton={
        <ConfirmDialog.ConfirmButton onPress={handleSubscribe}>
          {t('premiumDialog.subscribe')}
        </ConfirmDialog.ConfirmButton>
      }
    />
  );
}

export function usePremiumDialog() {
  const overlay = useOverlay();

  return useMemo(
    () => ({
      open: (options: { title?: string; description: string; onConfirm?: () => void }) => {
        overlay.open(({ isOpen, close, exit }) => (
          <PremiumDialog
            isOpen={isOpen}
            onOpenChange={(open) => {
              if (!open) {
                close();
                exit();
              }
            }}
            title={options.title}
            description={options.description}
            onConfirm={options.onConfirm}
          />
        ));
      },
    }),
    [overlay],
  );
}
