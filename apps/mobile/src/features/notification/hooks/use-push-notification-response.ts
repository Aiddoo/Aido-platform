import {
  useAppLifecycle,
  useLogger,
  useNotificationApi,
  usePushNotification,
  usePushNotificationEntryStore,
  useSessionEpoch,
} from '@src/bootstrap/providers/di-context';
import type { AppLogger } from '@src/core/ports/app-logger';
import type {
  PushNotificationResponse as OsPushNotificationResponse,
  PushNotificationGateway,
} from '@src/core/ports/push-notification-gateway';
import { useAuthStatus } from '@src/features/identity/auth/hooks/use-auth-status';
import { useTrack } from '@src/shared/analytics';
import { getNowInstant } from '@src/shared/date/clock';
import { getErrorMessage } from '@src/shared/errors';
import { useReportUnexpectedError } from '@src/shared/hooks/use-report-unexpected-error';
import { openEntryHref } from '@src/shared/navigation/open-entry-href';
import { useIsRestoring, useMutation } from '@tanstack/react-query';
import { useEffect, useEffectEvent, useLayoutEffect, useRef, useSyncExternalStore } from 'react';

import { parsePushNotificationResponse } from '../apis/push-notification-response.mapper';
import { NOTIFICATION_LOG_EVENT } from '../constants/notification-log-events';
import { NOTIFICATION_ENTRY_HOLD_MAX_MS } from '../constants/notification.constants';
import {
  type PushNotificationResponse,
  PushNotificationResponsePolicy,
} from '../domains/push-notification-response.model';
import { PushNotificationPolicy } from '../domains/push-notification.model';
import {
  useOptOutMarketingPushMutationOptions,
  useRecordPushOpenedMutationOptions,
} from '../queries/notification.mutations';
import type { ReadyPushNotificationEntry } from '../stores/push-notification-entry.store';
import { toPushNotificationOpenedEvent } from '../utils/push-notification-analytics';
import {
  useOpenNotificationDestination,
  useResolveNotificationDestination,
} from './use-notification-destination';
import { usePushNotificationEntry } from './use-push-notification-entry';
import { useRunTodoReminderAction } from './use-run-todo-reminder-action';

/**
 * 눌린 푸시의 입구 하나. OS 응답은 여기서만 구독해 슬롯(DI store)에 넣고, 아래 단계는 슬롯의 칸만 읽어
 * 응답 하나를 한 번씩 처리한다: 수신 거부 보내기, 소유를 확인해 목적지 정하기, 연 뒤 기록하기
 */
export function usePushNotificationResponse(): void {
  const { pending, ready, optOut } = usePushNotificationEntrySlots();

  useReceivePushNotificationResponses();
  useForgetResponsesOnSignOut();
  useMarketingOptOut(optOut);
  useResolveResponse(pending);
  useOpenReadyEntry(ready);
}

function usePushNotificationEntrySlots() {
  const store = usePushNotificationEntryStore();
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}

/** 시작할 때 읽은 마지막 응답과 응답 리스너를 슬롯 하나로 모은다. 같은 응답이 다시 오면 슬롯이 버린다 */
function useReceivePushNotificationResponses() {
  const gateway = usePushNotification();
  const appLifecycle = useAppLifecycle();
  const store = usePushNotificationEntryStore();
  const logger = useLogger();

  useLayoutEffect(() => {
    let activeSince = appLifecycle.getCurrentState() === 'active' ? getNowInstant() : null;
    const removeAppStateListener = appLifecycle.subscribe((state) => {
      activeSince = state === 'active' ? getNowInstant() : null;
    });
    const receive = (
      osResponse: OsPushNotificationResponse,
      { isLaunchResponse }: { isLaunchResponse: boolean },
    ) => {
      const { response, droppedPaths, isReadable } = parsePushNotificationResponse(osResponse, {
        receivedAt: getNowInstant(),
        isLaunchResponse,
        appState: appLifecycle.getCurrentState(),
        activeSince,
      });
      if (droppedPaths.length > 0) {
        logger.warn(NOTIFICATION_LOG_EVENT.PUSH_PAYLOAD_DROPPED, {
          source: 'response',
          responseId: osResponse.id,
          droppedPaths: droppedPaths.join(','),
          isReadable,
        });
      }
      store.receive(response);
    };
    const launchResponse = gateway.getLastResponse();
    if (launchResponse != null) {
      receive(launchResponse, { isLaunchResponse: true });
    }
    const removeResponseListener = gateway.subscribeResponse((osResponse) =>
      receive(osResponse, { isLaunchResponse: false }),
    );
    return () => {
      removeAppStateListener();
      removeResponseListener();
    };
  }, [appLifecycle, gateway, logger, store]);
}

/** 로그인한 세션이 끝나면 슬롯과 OS의 마지막 응답을 지워 다음 계정이 앞 계정의 탭을 열지 않게 한다 */
function useForgetResponsesOnSignOut() {
  const status = useAuthStatus();
  const gateway = usePushNotification();
  const store = usePushNotificationEntryStore();
  const logger = useLogger();
  const wasAuthenticatedRef = useRef(status === 'authenticated');

  useLayoutEffect(() => {
    const wasAuthenticated = wasAuthenticatedRef.current;
    wasAuthenticatedRef.current = status === 'authenticated';
    if (!wasAuthenticated || status === 'authenticated') {
      return;
    }
    store.clear();
    clearLastResponse(gateway, logger);
  }, [gateway, logger, status, store]);
}

/** 끝난 응답을 슬롯에서 빼고 재시작 중복을 막는다. 처리한 버튼 응답의 알림은 알림 센터에서 지운다 */
function useFinishResponse() {
  const gateway = usePushNotification();
  const store = usePushNotificationEntryStore();
  const logger = useLogger();

  return (response: PushNotificationResponse) => {
    store.settle(response.id);
    clearLastResponse(gateway, logger);
    if (PushNotificationResponsePolicy.shouldDismissNotification(response)) {
      gateway.dismissNotification(response.notificationIdentifier).catch((error: unknown) =>
        logger.warn(NOTIFICATION_LOG_EVENT.ACTION_NOTIFICATION_DISMISS_FAILED, {
          error: getErrorMessage(error),
        }),
      );
    }
  };
}

function useMarketingOptOut(response: PushNotificationResponse | null) {
  const status = useAuthStatus();
  const appLifecycle = useAppLifecycle();
  const logger = useLogger();
  const reportUnexpectedError = useReportUnexpectedError('notification');
  const finishResponse = useFinishResponse();
  const { mutateAsync: optOut } = useMutation(useOptOutMarketingPushMutationOptions());
  // 앞에 온 순간과 응답이 같은 틱에 두 번 부를 수 있어 응답 id로 한 번만 보낸다
  const inFlightIdRef = useRef<string | null>(null);

  const send = useEffectEvent(async (target: PushNotificationResponse, signal: AbortSignal) => {
    if (inFlightIdRef.current === target.id) {
      return;
    }
    const action = PushNotificationResponsePolicy.getResponseAction(target, {
      authStatus: status,
      now: getNowInstant(),
    });
    const token = target.notification.marketingOptOutToken;
    // 계약이 빈 토큰을 막지 않아 빈 값도 끌 대상이 없다고 본다
    if (action.type === 'drop' || token == null || token === '') {
      finishResponse(target);
      return;
    }
    inFlightIdRef.current = target.id;
    let isSent = false;
    try {
      await optOut(token);
      isSent = true;
    } catch (error) {
      // 응답을 남겨 앞에 오면 다시 보낸다. 연결 끊김·4xx는 다시 보내면 되고 5xx·파싱 실패만 이슈로 남긴다
      logger.warn(NOTIFICATION_LOG_EVENT.RESPONSE_DEFERRED, { error: getErrorMessage(error) });
      reportUnexpectedError(error);
    }
    inFlightIdRef.current = null;
    // 보내는 사이 로그아웃으로 슬롯이 비었으면 새 세션의 응답을 지우지 않는다
    if (isSent && !signal.aborted) {
      finishResponse(target);
    }
  });

  useEffect(() => {
    if (response == null) {
      return;
    }
    const controller = new AbortController();
    send(response, controller.signal);
    const removeAppStateListener = appLifecycle.subscribe((state) => {
      if (state === 'active') {
        send(response, controller.signal);
      }
    });
    return () => {
      controller.abort();
      removeAppStateListener();
    };
  }, [appLifecycle, response]);
}

/** 인증과 복원이 끝난 탭의 소유를 확인하고 목적지를 정한다 */
function useResolveResponse(response: PushNotificationResponse | null) {
  const status = useAuthStatus();
  const isRestoring = useIsRestoring();
  const store = usePushNotificationEntryStore();
  const notificationApi = useNotificationApi();
  const sessionEpoch = useSessionEpoch();
  const logger = useLogger();
  const resolveDestination = useResolveNotificationDestination();
  const finishResponse = useFinishResponse();
  const inFlightIdRef = useRef<string | null>(null);

  const resolve = useEffectEvent(async (target: PushNotificationResponse) => {
    if (inFlightIdRef.current === target.id) {
      return;
    }
    inFlightIdRef.current = target.id;
    const epoch = sessionEpoch.current();
    const isCurrent = () =>
      sessionEpoch.current() === epoch && store.getSnapshot().pending?.id === target.id;
    const { notification } = target;
    try {
      const ownership = await notificationApi.markAsReadAndCheckOwnership(
        notification.notificationId,
      );
      // 처리 중 표시를 풀기 전에 끝나지 않게 return 대신 갈래로 둔다. 끝난 세션이나 밀려난 탭이면 아무것도 하지 않는다
      if (isCurrent()) {
        if (ownership === 'foreign') {
          finishResponse(target);
        } else {
          store.markReady(target.id, resolveDestination(notification.target));
        }
      }
    } catch (error) {
      logger.warn(NOTIFICATION_LOG_EVENT.RESPONSE_OPEN_FAILED, { error: getErrorMessage(error) });
      // 끝난 세션이나 밀려난 탭의 실패로 새 탭의 마지막 응답을 지우지 않는다
      if (isCurrent()) {
        finishResponse(target);
      }
    }
    if (inFlightIdRef.current === target.id) {
      inFlightIdRef.current = null;
    }
  });

  const decide = useEffectEvent((target: PushNotificationResponse) => {
    const action = PushNotificationResponsePolicy.getResponseAction(target, {
      authStatus: status,
      now: getNowInstant(),
    });
    if (action.type === 'drop') {
      finishResponse(target);
      return;
    }
    if (action.type === 'open' && !isRestoring) {
      resolve(target);
    }
  });

  useEffect(() => {
    if (response != null) {
      decide(response);
    }
  }, [isRestoring, response, status]);
}

/** 앱에 들어가는 중이면 Index가 경로를 열고, 앱 안이면 여기서 연다. 연 뒤 열림을 한 번 남긴다 */
function useOpenReadyEntry(entry: ReadyPushNotificationEntry | null) {
  const { isEnteringApp } = usePushNotificationEntry();
  const logger = useLogger();
  // 앱이 켜져 있을 때 누른 푸시도 OS 링크처럼 연다. 탭 위 화면에서 열어도 탭 묶음·첫 화면이 두 번 쌓이지 않는다
  const openDestination = useOpenNotificationDestination({ openRoute: openEntryHref });
  const finishResponse = useFinishResponse();
  const { record: recordOpened, recordOnServer: recordOpenedOnServer } = useRecordOpened();
  const runTodoReminderAction = useRunTodoReminderAction();
  const openedByIndexIdRef = useRef<string | null>(null);
  const inFlightIdRef = useRef<string | null>(null);

  // 할 일 화면에 내린 뒤 보내 결과 안내가 그 화면 위에 뜬다. 응답 슬롯은 기다리지 않고 비운다
  const startTodoReminderAction = (response: PushNotificationResponse) => {
    const reminderAction = PushNotificationResponsePolicy.findTodoReminderAction(response);
    if (reminderAction == null) {
      return;
    }
    runTodoReminderAction(reminderAction).catch((error: unknown) =>
      logger.warn(NOTIFICATION_LOG_EVENT.REMINDER_ACTION_FAILED, {
        error: getErrorMessage(error),
      }),
    );
  };

  const open = useEffectEvent(async ({ response, destination }: ReadyPushNotificationEntry) => {
    if (inFlightIdRef.current === response.id) {
      return;
    }
    inFlightIdRef.current = response.id;
    const isOpenedByIndex =
      destination.kind === 'route' && openedByIndexIdRef.current === response.id;
    // finally를 쓰면 React Compiler가 이 훅을 건너뛰어, 정리는 try/catch 뒤에 둬 어느 길로 끝나도 돈다
    try {
      if (!isOpenedByIndex) {
        await openDestination(destination);
      }
      recordOpened(response);
      startTodoReminderAction(response);
    } catch (error) {
      // 외부 링크를 열지 못했거나 연 뒤의 기록이 실패한 경우다. 같은 탭을 다시 시도하지 않고 끝낸다
      logger.warn(NOTIFICATION_LOG_EVENT.RESPONSE_OPEN_FAILED, { error: getErrorMessage(error) });
    }
    inFlightIdRef.current = null;
    finishResponse(response);
  });

  // 목적지로 못 가 피드로 보내도 사용자는 알림을 열었으므로 열람(읽음 포함)은 남긴다
  const abandon = useEffectEvent(({ response }: ReadyPushNotificationEntry) => {
    logger.warn(NOTIFICATION_LOG_EVENT.RESPONSE_OPEN_FAILED, { responseId: response.id });
    recordOpenedOnServer(response);
    finishResponse(response);
  });

  useEffect(() => {
    if (entry == null) {
      return;
    }
    if (!isEnteringApp) {
      open(entry);
      return;
    }
    openedByIndexIdRef.current = entry.response.id;
    // Index가 이동하지 못하면 슬롯을 비워 피드로 보낸다
    const timer = setTimeout(() => abandon(entry), NOTIFICATION_ENTRY_HOLD_MAX_MS);
    return () => clearTimeout(timer);
  }, [entry, isEnteringApp]);
}

interface RecordOpened {
  /** 연 푸시를 분석에 한 번, 서버 기록이 있으면 열림(읽음 포함)에 한 번 남긴다. 분석이 실패해도 열림은 남긴다 */
  record: (response: PushNotificationResponse) => void;
  /** 목적지로 가지 못했어도 사용자가 연 알림의 열림만 남긴다 */
  recordOnServer: (response: PushNotificationResponse) => void;
}

function useRecordOpened(): RecordOpened {
  const logger = useLogger();
  const { trackEvent } = useTrack();
  const { mutate: recordPushOpened } = useMutation(useRecordPushOpenedMutationOptions());

  const recordOnServer = (response: PushNotificationResponse) => {
    if (PushNotificationPolicy.hasServerRecord(response.notification)) {
      recordPushOpened(response.notification.notificationId);
    }
  };

  const record = (response: PushNotificationResponse) => {
    try {
      trackEvent('push_notification_opened', toPushNotificationOpenedEvent(response));
      if (response.notification.type === 'WEEKLY_ACHIEVEMENT') {
        trackEvent('badge_opened_from_notification');
      }
    } catch (error) {
      logger.warn(NOTIFICATION_LOG_EVENT.OPEN_ANALYTICS_FAILED, { error: getErrorMessage(error) });
    }
    recordOnServer(response);
  };

  return { record, recordOnServer };
}

/** 재시작 중복을 막으려 OS의 마지막 응답을 지운다. 지우지 못해도 슬롯이 처리한 응답을 기억해 경고만 남긴다 */
function clearLastResponse(gateway: PushNotificationGateway, logger: AppLogger) {
  try {
    gateway.clearLastResponse();
  } catch (error) {
    logger.warn(NOTIFICATION_LOG_EVENT.SESSION_RESPONSE_CLEANUP_FAILED, {
      error: getErrorMessage(error),
    });
  }
}
