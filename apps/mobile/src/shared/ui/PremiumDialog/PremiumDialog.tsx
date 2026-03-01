import { ConfirmDialog } from '@src/shared/ui/ConfirmDialog';
import { useOverlay } from '@src/shared/ui/Overlay';
import { useRouter } from 'expo-router';
import type { PremiumDialogProps } from './PremiumDialog.types';

export function PremiumDialog({
  isOpen,
  onOpenChange,
  title = '프리미엄 기능',
  description,
}: PremiumDialogProps) {
  const router = useRouter();

  const handleSubscribe = () => {
    onOpenChange(false);
    router.push('/settings/subscription');
  };

  return (
    <ConfirmDialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={<ConfirmDialog.Title>{title}</ConfirmDialog.Title>}
      description={<ConfirmDialog.Description>{description}</ConfirmDialog.Description>}
      cancelButton={
        <ConfirmDialog.CancelButton onPress={() => onOpenChange(false)}>
          닫기
        </ConfirmDialog.CancelButton>
      }
      confirmButton={
        <ConfirmDialog.ConfirmButton onPress={handleSubscribe}>
          구독하기
        </ConfirmDialog.ConfirmButton>
      }
    />
  );
}

export function usePremiumDialog() {
  const overlay = useOverlay();

  return {
    open: (options: { title?: string; description: string }) => {
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
        />
      ));
    },
  };
}
