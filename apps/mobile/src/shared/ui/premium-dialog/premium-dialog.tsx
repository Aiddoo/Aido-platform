import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { ConfirmDialog } from '@src/shared/ui/confirm-dialog';
import { TextButton } from '@src/shared/ui/text-button';

import type { PremiumDialogAlternativeAction, PremiumDialogProps } from './premium-dialog.types';

export function PremiumDialog({
  isOpen,
  onOpenChange,
  title,
  description,
  onSubscribe,
  alternativeAction,
}: PremiumDialogProps) {
  const subscribe = useSingleTap(onSubscribe);
  const runAlternative = useSingleTap((action: PremiumDialogAlternativeAction) => action.onPress());

  const { t } = useTranslation();

  const handleSubscribe = () => {
    onOpenChange(false);
    subscribe();
  };

  const handleAlternative = (action: PremiumDialogAlternativeAction) => {
    onOpenChange(false);
    runAlternative(action);
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
