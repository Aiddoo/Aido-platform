import { PushPermissionDialog } from '@src/features/notification/components/push-permission-dialog';

import { usePushPermissionAskMoment } from '../hooks/use-push-permission-ask-moment';

export function ActivationPushPermissionDialog() {
  const [isDue, complete] = usePushPermissionAskMoment();

  return (
    <PushPermissionDialog
      source="activation"
      isOpen={isDue}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          complete();
        }
      }}
    />
  );
}
