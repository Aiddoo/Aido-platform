import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { ConfirmDialog } from '@src/shared/ui/confirm-dialog';
import { useOverlay } from '@src/shared/ui/overlay';
import { TextButton } from '@src/shared/ui/text-button';
import { router } from 'expo-router';
import { useMemo } from 'react';

import type { PremiumDialogAlternativeAction, PremiumDialogProps } from './premium-dialog.types';

export function PremiumDialog({
  isOpen,
  onOpenChange,
  title,
  description,
  onConfirm,
  alternativeAction,
}: PremiumDialogProps) {
  const navigate = useSingleTap(router.navigate);

  const { t } = useTranslation();

  const handleSubscribe = () => {
    onOpenChange(false);
    onConfirm?.();
    navigate('/settings/subscription');
  };

  const handleAlternative = (action: PremiumDialogAlternativeAction) => {
    onOpenChange(false);
    action.onPress();
  };

  if (alternativeAction != null) {
    return (
      <ConfirmDialog
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        title={<ConfirmDialog.Title>{title ?? t('premiumDialog.title')}</ConfirmDialog.Title>}
        description={<ConfirmDialog.Description>{description}</ConfirmDialog.Description>}
        confirmButton={
          <ConfirmDialog.ConfirmButton onPress={() => handleAlternative(alternativeAction)}>
            {alternativeAction.label}
          </ConfirmDialog.ConfirmButton>
        }
        secondaryButton={
          <ConfirmDialog.CancelButton onPress={handleSubscribe}>
            {t('premiumDialog.subscribeUnlimited')}
          </ConfirmDialog.CancelButton>
        }
        cancelButton={
          <TextButton size="medium" onPress={() => onOpenChange(false)} className="self-center">
            {t('premiumDialog.close')}
          </TextButton>
        }
      />
    );
  }

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
      open: (
        options: Pick<
          PremiumDialogProps,
          'title' | 'description' | 'onConfirm' | 'alternativeAction'
        >,
      ) => {
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
            alternativeAction={options.alternativeAction}
          />
        ));
      },
    }),
    [overlay],
  );
}
