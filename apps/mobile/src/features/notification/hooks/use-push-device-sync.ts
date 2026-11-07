import { usePushNotification } from '@src/bootstrap/providers/di-context';
import type { AuthStatus } from '@src/core/session/auth-status';
import { i18n } from '@src/shared/i18n';
import { useMutation } from '@tanstack/react-query';
import { debounce, noop } from 'es-toolkit';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useReportPushDeviceMutationOptions } from '../queries/notification.mutations';

/** 권한 창·제어 센터처럼 짧게 오가는 복귀를 한 번으로 묶는다 */
const APP_ACTIVE_SYNC_DELAY_MS = 1_000;

/**
 * 로그인한 기기의 알림 권한·토큰과 시간대를 서버와 맞춘다. 권한만 있으면 토큰이 빠진 채로 남지 않게
 * 로그인 확인 직후·앱 복귀·푸시 탭·토큰 변경·언어 변경·시간대 변경 때 보고한다.
 * 보고 중에 다시 불리면 끝난 뒤 한 번만 더 보낸다.
 */
export function usePushDeviceSync({
  authStatus,
  deviceTimeZone,
  onReported,
}: {
  authStatus: AuthStatus;
  /** 앞에 떠 있는 채로 시간대가 바뀌면 복귀 이벤트가 없어 이 값으로 알아챈다 */
  deviceTimeZone?: string;
  /** 보고가 성공하면 부른다. 값이 같아 요청을 건너뛴 때도 부른다 */
  onReported?: () => void;
}) {
  const pushNotification = usePushNotification();
  const { mutateAsync: reportPushDevice } = useMutation(useReportPushDeviceMutationOptions());
  const isAuthenticated = authStatus === 'authenticated';

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    let isSubscribed = true;
    let isReporting = false;
    let pendingForce: boolean | null = null;

    const sync = (force: boolean) => {
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
            sync(nextForce);
          }
        });
    };
    const syncOnActive = debounce(() => sync(false), APP_ACTIVE_SYNC_DELAY_MS);
    // 서버는 푸시 문구 언어를 요청 헤더에서 읽으므로 권한·토큰이 같아도 다시 보낸다
    const handleLanguageChanged = () => sync(true);

    // 다른 계정이 쓰던 기기일 수 있어 로그인 확인 직후에는 같은 값이어도 보낸다
    sync(true);
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        syncOnActive();
      }
    });
    const removeTokenListener = pushNotification.subscribeToken(() => sync(false));
    // 앞에 떠 있는 동안 누른 푸시는 복귀 이벤트 없이 온다. 꺼진 상태에서 누른 푸시는 위의 첫 보고가 맡는다
    const removeResponseListener = pushNotification.subscribeResponse(syncOnActive);
    i18n.on('languageChanged', handleLanguageChanged);

    return () => {
      isSubscribed = false;
      appStateSubscription.remove();
      syncOnActive.cancel();
      removeTokenListener();
      removeResponseListener();
      i18n.off('languageChanged', handleLanguageChanged);
    };
  }, [deviceTimeZone, isAuthenticated, onReported, pushNotification, reportPushDevice]);
}
