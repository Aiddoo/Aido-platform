import { PushPermissionDialog } from '@src/features/notification/components/push-permission-dialog';

import { usePushPermissionAskMoment } from '../hooks/use-push-permission-ask-moment';

/** 활성화 시점이 되면 시스템 권한 창 전에 앱 안 안내를 한 번 띄운다 */
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
