import { useAppLifecycle, usePushNotification } from '@src/bootstrap/providers/di-context';
import type { AuthStatus } from '@src/core/session/auth-status';
import { i18n } from '@src/shared/i18n';
import { useMutation } from '@tanstack/react-query';
import { debounce, noop } from 'es-toolkit';
import { useEffect } from 'react';

import { useReportPushDeviceMutationOptions } from '../queries/notification.mutations';

const APP_ACTIVE_SYNC_DELAY_MS = 1_000;

/** 로그인한 기기의 알림 권한·토큰과 시간대를 서버와 맞춘다 */
export function usePushDeviceSync({
  authStatus,
  deviceTimeZone,
  onReported,
}: {
  authStatus: AuthStatus;
  deviceTimeZone?: string;
  onReported?: () => void;
}) {
  const pushNotification = usePushNotification();
  const appLifecycle = useAppLifecycle();
  const { mutateAsync: reportPushDevice } = useMutation(useReportPushDeviceMutationOptions());
  const isAuthenticated = authStatus === 'authenticated';

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    let isSubscribed = true;
    let isReporting = false;
    let pendingForce: boolean | null = null;

    const sync = ({ force }: { force: boolean }) => {
      if (isReporting) {
        pendingForce = pendingForce === true || force;
        return;
      }
      isReporting = true;
      reportPushDevice({ force })
        .then(() => onReported?.())
        .catch(noop)
        .finally(() => {
          isReporting = false;
          const nextForce = pendingForce;
          pendingForce = null;
          if (isSubscribed && nextForce != null) {
            sync({ force: nextForce });
          }
        });
    };
    const syncOnActive = debounce(() => sync({ force: false }), APP_ACTIVE_SYNC_DELAY_MS);
    // 서버는 푸시 문구 언어를 요청 헤더에서 읽으므로 권한·토큰이 같아도 다시 보낸다
    const handleLanguageChanged = () => sync({ force: true });

    sync({ force: true });
    const removeAppStateListener = appLifecycle.subscribe((state) => {
      if (state === 'active') {
        syncOnActive();
      }
    });
    const removeTokenListener = pushNotification.subscribeToken(() => sync({ force: false }));
    const removeResponseListener = pushNotification.subscribeResponse(syncOnActive);
    i18n.on('languageChanged', handleLanguageChanged);

    return () => {
      isSubscribed = false;
      removeAppStateListener();
      syncOnActive.cancel();
      removeTokenListener();
      removeResponseListener();
      i18n.off('languageChanged', handleLanguageChanged);
    };
  }, [
    appLifecycle,
    deviceTimeZone,
    isAuthenticated,
    onReported,
    pushNotification,
    reportPushDevice,
  ]);
}
