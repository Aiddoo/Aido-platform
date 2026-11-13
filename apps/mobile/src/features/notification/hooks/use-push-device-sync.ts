import {
  usePushNotification,
  usePushRegistrationService,
} from '@src/bootstrap/providers/di-context';
import type { AuthStatus } from '@src/core/session/auth-status';
import { useIsOnline } from '@src/shared/hooks/use-is-online';
import { useOnAppForeground } from '@src/shared/hooks/use-on-app-foreground';
import { i18n } from '@src/shared/i18n';
import { useMutation } from '@tanstack/react-query';
import { debounce, noop } from 'es-toolkit';
import { useEffect, useEffectEvent, useRef } from 'react';

import type { PushDevice } from '../domains/push-permission.model';
import { useReportPushDeviceMutationOptions } from '../queries/push-device.mutations';

/** 권한 창·제어 센터처럼 짧게 오가는 복귀를 한 번으로 묶는다 */
const APP_ACTIVE_SYNC_DELAY_MS = 1_000;

interface UsePushDeviceSyncOptions {
  authStatus: AuthStatus;
  /** 앞에 떠 있는 채로 시간대가 바뀌면 복귀 이벤트가 없어 이 값으로 알아챈다 */
  deviceTimeZone?: string;
  /** 보고가 성공하면 부른다. 값이 같아 요청을 건너뛴 때도 부르고, 세션이 끝나 보내지 않았거나 끝난 뒤 도착한 보고는 알리지 않는다 */
  onReported?: () => void;
}

/** 기기 등록을 서버와 맞춘다. 로그인한 동안은 권한·토큰을 보고하고, 로그아웃 상태에서는 끝난 세션의 해제를 다시 보낸다 */
export function usePushDeviceSync({
  authStatus,
  deviceTimeZone,
  onReported,
}: UsePushDeviceSyncOptions) {
  useReportPushDevice({
    isAuthenticated: authStatus === 'authenticated',
    deviceTimeZone,
    onReported,
  });
  useFlushPushDeviceRelease({ isSignedOut: authStatus === 'unauthenticated' });
}

/** 권한만 있고 토큰이 빠진 채로 남지 않게 여러 시점에 보고한다 */
function useReportPushDevice({
  isAuthenticated,
  deviceTimeZone,
  onReported,
}: {
  isAuthenticated: boolean;
  deviceTimeZone: string | undefined;
  onReported: (() => void) | undefined;
}) {
  const pushNotification = usePushNotification();
  const { mutateAsync: reportPushDevice } = useMutation(useReportPushDeviceMutationOptions());
  const reporterRef = useRef<PushDeviceReporter | null>(null);
  const handleReported = useEffectEvent(() => onReported?.());

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const reporter = createPushDeviceReporter({
      report: reportPushDevice,
      onReported: handleReported,
    });
    reporterRef.current = reporter;
    // 서버는 푸시 문구 언어를 요청 헤더에서 읽으므로 권한·토큰이 같아도 다시 보낸다
    const handleLanguageChanged = () => reporter.sync({ force: true });

    // 다른 계정이 쓰던 기기일 수 있어 로그인 확인 직후에는 같은 값이어도 보낸다
    reporter.sync({ force: true });
    const removeTokenListener = pushNotification.subscribeToken(() =>
      reporter.sync({ force: false }),
    );
    // 앞에 떠 있는 동안 누른 푸시는 복귀 이벤트 없이 온다. 꺼진 상태에서 누른 푸시는 위의 첫 보고가 맡는다
    const removeResponseListener = pushNotification.subscribeResponse(reporter.syncSoon);
    i18n.on('languageChanged', handleLanguageChanged);

    return () => {
      reporterRef.current = null;
      reporter.close();
      removeTokenListener();
      removeResponseListener();
      i18n.off('languageChanged', handleLanguageChanged);
    };
  }, [deviceTimeZone, isAuthenticated, pushNotification, reportPushDevice]);

  useOnAppForeground(() => reporterRef.current?.syncSoon());
}

/** 끝난 세션의 기기 해제를 로그아웃 상태에서 연결될 때와 앱이 앞으로 올 때 다시 보낸다. 로그인하면 새 보고가 해제를 대신한다 */
function useFlushPushDeviceRelease({ isSignedOut }: { isSignedOut: boolean }) {
  const pushRegistrationService = usePushRegistrationService();
  const isOnline = useIsOnline();
  const canFlush = isSignedOut && isOnline;

  useEffect(() => {
    if (canFlush) {
      pushRegistrationService.flushRelease();
    }
  }, [canFlush, pushRegistrationService]);

  useOnAppForeground(() => {
    if (canFlush) {
      pushRegistrationService.flushRelease();
    }
  });
}

interface PushDeviceReporter {
  sync(options: { force: boolean }): void;
  /** 짧게 오가는 복귀를 묶어 잠시 뒤 한 번 보낸다 */
  syncSoon(): void;
  /** 이 세션의 보고를 끝낸다. 가는 중인 보고의 결과는 알리지 않고 이어 보내지도 않는다 */
  close(): void;
}

/** 보고 중에 다시 불리면 겹쳐 보내지 않고 끝난 뒤 한 번만 더 보낸다 */
function createPushDeviceReporter({
  report,
  onReported,
}: {
  report: (variables: { force: boolean }) => Promise<PushDevice | null>;
  onReported: () => void;
}): PushDeviceReporter {
  let isClosed = false;
  let isReporting = false;
  let pendingForce: boolean | null = null;

  const sync = ({ force }: { force: boolean }) => {
    if (isClosed) {
      return;
    }
    if (isReporting) {
      pendingForce = pendingForce === true || force;
      return;
    }
    isReporting = true;
    report({ force })
      .then((device) => {
        // 로그아웃·언마운트 뒤 끝난 보고는 다음 세션의 시간대 안내를 미리 깨우지 않게 알리지 않는다
        if (!isClosed && device != null) {
          onReported();
        }
      })
      .catch(noop)
      .finally(() => {
        isReporting = false;
        const nextForce = pendingForce;
        pendingForce = null;
        if (nextForce != null) {
          sync({ force: nextForce });
        }
      });
  };
  const syncSoon = debounce(() => sync({ force: false }), APP_ACTIVE_SYNC_DELAY_MS);

  return {
    sync,
    syncSoon,
    close: () => {
      isClosed = true;
      syncSoon.cancel();
    },
  };
}
