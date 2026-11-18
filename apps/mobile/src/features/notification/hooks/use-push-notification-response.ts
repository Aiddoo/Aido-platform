import { TODO_REMINDER_SNOOZE_MINUTES } from '@aido/api/vocabulary';
import {
  useAppLifecycle,
  useLogger,
  useNotificationApi,
  usePushNotification,
  usePushNotificationEntryStore,
  useSessionEpoch,
} from '@src/bootstrap/providers/di-context';
import type { PushNotificationResponse as OsPushNotificationResponse } from '@src/core/ports/push-notification-gateway';
import { useAuthStatus } from '@src/features/identity/auth/hooks/use-auth-status';
import {
  ensurePreference,
  getCachedPreference,
} from '@src/features/identity/preference/queries/preference-cache';
import { useGetPreferenceQueryOptions } from '@src/features/identity/preference/queries/preference.queries';
import { isTodoUnavailableError } from '@src/features/planning/todo/domains/todo.error';
import { fetchFreshTodoDetails } from '@src/features/planning/todo/queries/todo-cache';
import { useToggleTodoMutationOptions } from '@src/features/planning/todo/queries/todo.mutations';
import { useGetTodoDetailsQueryOptionsFactory } from '@src/features/planning/todo/queries/todo.queries';
import { useTrack } from '@src/shared/analytics';
import { getNowInstant } from '@src/shared/date/clock';
import type { DateKey } from '@src/shared/date/date-key';
import { formatClockTime } from '@src/shared/date/format/date-format';
import type { Instant } from '@src/shared/date/instant';
import { getErrorMessage } from '@src/shared/errors';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useReportUnexpectedError } from '@src/shared/hooks/use-report-unexpected-error';
import { useTranslation } from '@src/shared/i18n';
import { openEntryHref } from '@src/shared/navigation/open-entry-href';
import { readWithoutBlocking } from '@src/shared/query/read-without-blocking';
import { useAppToast } from '@src/shared/ui';
import {
  mutationOptions,
  useIsRestoring,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { noop } from 'es-toolkit';
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
} from 'react';
import { match } from 'ts-pattern';

import { parsePushNotification } from '../apis/push-notification.mapper';
import { NOTIFICATION_LOG_EVENT } from '../constants/notification-log-events';
import { NOTIFICATION_ENTRY_HOLD_MAX_MS } from '../constants/notification.constants';
import { getTodoReminderActionFailure } from '../domains/notification.error';
import {
  type PushNotificationResponse,
  PushNotificationResponsePolicy,
  toPushNotificationResponseId,
  type TodoReminderActionOutcome,
  type TodoReminderActionRequest,
} from '../domains/push-notification-response.model';
import {
  createUnreadablePushNotification,
  PushNotificationPolicy,
} from '../domains/push-notification.model';
import {
  useOptOutMarketingPushMutationOptions,
  useRecordPushOpenedMutationOptions,
  useSnoozeTodoReminderMutationOptions,
} from '../queries/notification.mutations';
import type { ReadyPushNotificationEntry } from '../stores/push-notification-entry.store';
import {
  useOpenNotificationDestination,
  useResolveNotificationDestination,
} from './use-notification-destination';
import { usePushNotificationEntry } from './use-push-notification-entry';

/** 푸시 응답의 입구 하나. 마지막 응답과 응답 리스너를 슬롯 하나로 모은다 */
export function usePushNotificationResponse(): void {
  const status = useAuthStatus();
  const gateway = usePushNotification();
  const appLifecycle = useAppLifecycle();
  const store = usePushNotificationEntryStore();
  const logger = useLogger();
  const { pending, ready, optOut } = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const clearLastResponse = useCallback(() => {
    try {
      gateway.clearLastResponse();
    } catch (error) {
      logger.warn(NOTIFICATION_LOG_EVENT.SESSION_RESPONSE_CLEANUP_FAILED, {
        error: getErrorMessage(error),
      });
    }
  }, [gateway, logger]);
  const finishResponse = useCallback(
    (responseId: string) => {
      store.settle(responseId);
      clearLastResponse();
    },
    [clearLastResponse, store],
  );

  useLayoutEffect(() => {
    let activeSince = appLifecycle.getCurrentState() === 'active' ? getNowInstant() : null;
    const removeAppStateListener = appLifecycle.subscribe((state) => {
      activeSince = state === 'active' ? getNowInstant() : null;
    });
    const receive = (
      response: OsPushNotificationResponse,
      { isLaunchResponse }: { isLaunchResponse: boolean },
    ) => {
      const { notification, droppedPaths } = parsePushNotification(response.data);
      if (droppedPaths.length > 0) {
        logger.warn(NOTIFICATION_LOG_EVENT.PUSH_PAYLOAD_DROPPED, {
          source: 'response',
          responseId: response.id,
          droppedPaths: droppedPaths.join(','),
          isReadable: notification != null,
        });
      }
      store.receive({
        id: toPushNotificationResponseId(response.id, response.actionIdentifier),
        actionIdentifier: response.actionIdentifier,
        notification: notification ?? createUnreadablePushNotification(),
        receivedAt: getNowInstant(),
        isLaunchResponse,
        appState: appLifecycle.getCurrentState(),
        activeSince,
      });
    };
    const launchResponse = gateway.getLastResponse();
    if (launchResponse != null) {
      receive(launchResponse, { isLaunchResponse: true });
    }
    const removeResponseListener = gateway.subscribeResponse((response) =>
      receive(response, { isLaunchResponse: false }),
    );
    return () => {
      removeAppStateListener();
      removeResponseListener();
    };
  }, [appLifecycle, gateway, logger, store]);

  const wasAuthenticatedRef = useRef(status === 'authenticated');
  useLayoutEffect(() => {
    const wasAuthenticated = wasAuthenticatedRef.current;
    wasAuthenticatedRef.current = status === 'authenticated';
    if (!wasAuthenticated || status === 'authenticated') {
      return;
    }
    store.clear();
    clearLastResponse();
  }, [clearLastResponse, status, store]);

  useMarketingOptOut(optOut, finishResponse);
  useResolveResponse(pending, finishResponse);
  useOpenReadyEntry(ready, finishResponse);
}

function useMarketingOptOut(
  response: PushNotificationResponse | null,
  finishResponse: (responseId: string) => void,
) {
  const status = useAuthStatus();
  const appLifecycle = useAppLifecycle();
  const logger = useLogger();
  const reportUnexpectedError = useReportUnexpectedError('notification');
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
      finishResponse(target.id);
      return;
    }
    inFlightIdRef.current = target.id;
    try {
      await optOut(token);
    } catch (error) {
      // 응답을 남겨 앞에 오면 다시 보낸다. 연결 끊김·4xx는 다시 보내면 되고 5xx·파싱 실패만 이슈로 남긴다
      logger.warn(NOTIFICATION_LOG_EVENT.RESPONSE_DEFERRED, { error: getErrorMessage(error) });
      reportUnexpectedError(error);
      return;
    } finally {
      inFlightIdRef.current = null;
    }
    // 보내는 사이 로그아웃으로 슬롯이 비었으면 새 세션의 응답을 지우지 않는다
    if (!signal.aborted) {
      finishResponse(target.id);
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
function useResolveResponse(
  response: PushNotificationResponse | null,
  finishResponse: (responseId: string) => void,
) {
  const status = useAuthStatus();
  const isRestoring = useIsRestoring();
  const store = usePushNotificationEntryStore();
  const notificationApi = useNotificationApi();
  const sessionEpoch = useSessionEpoch();
  const logger = useLogger();
  const resolveDestination = useResolveNotificationDestination();
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
      if (!isCurrent()) {
        return;
      }
      if (ownership === 'foreign') {
        finishResponse(target.id);
        return;
      }
      store.markReady(target.id, resolveDestination(notification.target));
    } catch (error) {
      logger.warn(NOTIFICATION_LOG_EVENT.RESPONSE_OPEN_FAILED, { error: getErrorMessage(error) });
      // 끝난 세션이나 밀려난 탭의 실패로 새 탭의 마지막 응답을 지우지 않는다
      if (isCurrent()) {
        finishResponse(target.id);
      }
    } finally {
      if (inFlightIdRef.current === target.id) {
        inFlightIdRef.current = null;
      }
    }
  });

  const decide = useEffectEvent((target: PushNotificationResponse) => {
    const action = PushNotificationResponsePolicy.getResponseAction(target, {
      authStatus: status,
      now: getNowInstant(),
    });
    if (action.type === 'drop') {
      finishResponse(target.id);
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

/** 앱에 들어가는 중이면 Index가 경로를 열고, 앱 안이면 여기서 연다 */
function useOpenReadyEntry(
  entry: ReadyPushNotificationEntry | null,
  finishResponse: (responseId: string) => void,
) {
  const { isEnteringApp } = usePushNotificationEntry();
  const logger = useLogger();
  // 앱이 켜져 있을 때 누른 푸시도 OS 링크처럼 연다. 탭 위 화면에서 열어도 탭 묶음·첫 화면이 두 번 쌓이지 않는다
  const openDestination = useOpenNotificationDestination({ openRoute: openEntryHref });
  const { trackEvent } = useTrack();
  const { mutate: recordOpened } = useMutation(useRecordPushOpenedMutationOptions());
  const runTodoReminderAction = useRunTodoReminderAction();
  const openedByIndexIdRef = useRef<string | null>(null);
  const inFlightIdRef = useRef<string | null>(null);

  const open = useEffectEvent(async ({ response, destination }: ReadyPushNotificationEntry) => {
    if (inFlightIdRef.current === response.id) {
      return;
    }
    inFlightIdRef.current = response.id;
    const { notification } = response;
    try {
      if (destination.kind !== 'route' || openedByIndexIdRef.current !== response.id) {
        await openDestination(destination);
      }
      try {
        trackEvent('push_notification_opened', {
          type: notification.type ?? 'UNKNOWN',
          action: notification.actionType,
          app_state: PushNotificationResponsePolicy.getOpenAppState(response),
          ...(notification.campaignKey && { campaign_key: notification.campaignKey }),
          ...(notification.variantId && { variant_id: notification.variantId }),
          ...(notification.purpose && { purpose: notification.purpose }),
        });
        if (notification.type === 'WEEKLY_ACHIEVEMENT') {
          trackEvent('badge_opened_from_notification');
        }
      } catch (error) {
        logger.warn(NOTIFICATION_LOG_EVENT.OPEN_ANALYTICS_FAILED, {
          error: getErrorMessage(error),
        });
      }
      if (PushNotificationPolicy.hasServerRecord(notification)) {
        recordOpened(notification.notificationId);
      }
      const reminderAction = PushNotificationResponsePolicy.getTodoReminderAction(response);
      if (reminderAction != null) {
        // 할 일 화면에 내린 뒤 보내 결과 안내가 그 화면 위에 뜬다. 응답 슬롯은 기다리지 않고 비운다
        runTodoReminderAction(reminderAction).catch((error: unknown) =>
          logger.warn(NOTIFICATION_LOG_EVENT.REMINDER_ACTION_FAILED, {
            error: getErrorMessage(error),
          }),
        );
      }
    } catch (error) {
      // 외부 링크를 열지 못한 경우다. 같은 탭을 다시 시도하지 않고 끝낸다
      logger.warn(NOTIFICATION_LOG_EVENT.RESPONSE_OPEN_FAILED, { error: getErrorMessage(error) });
    } finally {
      inFlightIdRef.current = null;
      finishResponse(response.id);
    }
  });

  // 목적지로 못 가 피드로 보내도 사용자는 알림을 열었으므로 열람(읽음 포함)은 남긴다
  const abandon = useEffectEvent(({ response }: ReadyPushNotificationEntry) => {
    logger.warn(NOTIFICATION_LOG_EVENT.RESPONSE_OPEN_FAILED, { responseId: response.id });
    if (PushNotificationPolicy.hasServerRecord(response.notification)) {
      recordOpened(response.notification.notificationId);
    }
    finishResponse(response.id);
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

/** 성공 안내를 띄울 결과와, 안내 없이 분석에만 남기는 결과 */
type TodoReminderActionResult =
  | { outcome: 'succeeded'; message: string; description: string | null }
  | { outcome: Exclude<TodoReminderActionOutcome, 'succeeded'> };

/**
 * 리마인드 알림 버튼(완료·10분 뒤 다시)으로 할 일을 바꾸고 결과를 알린다. 이미 끝낸 할 일은 부드럽게 알리고,
 * 지운 할 일은 할 일 화면의 볼 수 없음 안내가, 그 밖의 실패는 상세 조회의 화면 오류나 변경의 전역 오류 피드백이 알린다
 */
function useRunTodoReminderAction() {
  const { t } = useTranslation('notification');
  const queryClient = useQueryClient();
  const sessionEpoch = useSessionEpoch();
  const logger = useLogger();
  const toast = useAppToast();
  const { trackEvent } = useTrack();
  const dateFormatContext = useDateFormatContext();
  const preferenceQueryOptions = useGetPreferenceQueryOptions();
  const getTodoDetailsQueryOptions = useGetTodoDetailsQueryOptionsFactory();
  const { mutateAsync: completeTodo } = useMutation(useCompleteRemindedTodoMutationOptions());
  const { mutateAsync: snoozeTodoReminder } = useMutation(useSnoozeTodoReminderMutationOptions());

  const complete = async (
    todoId: number,
    dateKey: DateKey | null,
  ): Promise<TodoReminderActionResult> => {
    // 다른 기기에서 끝냈을 수 있어 캐시가 아닌 서버 값으로 정한다. 방금 연 할 일 화면과 같은 조회라 요청은 하나다
    const { todo } = await fetchFreshTodoDetails(queryClient, getTodoDetailsQueryOptions(todoId));
    if (todo.completed) {
      return { outcome: 'already_completed' };
    }
    const saved = await completeTodo({
      todoId,
      body: { completed: true },
      date: dateKey ?? todo.startDate,
    });
    return {
      outcome: 'succeeded',
      message: t('reminderActions.completed', { title: saved.title }),
      description: null,
    };
  };

  // 서버가 정한 시각을 앱의 12·24시간 설정으로 보인다. 설정을 바로 읽지 못하면 시각 없이 알린다
  const describeRemindAt = async (remindAt: Instant) => {
    const preference = await readWithoutBlocking(
      getCachedPreference(queryClient),
      () => ensurePreference(queryClient, preferenceQueryOptions),
      (error) =>
        logger.warn(NOTIFICATION_LOG_EVENT.REMINDER_SNOOZE_TIME_SKIPPED, {
          error: getErrorMessage(error),
        }),
    );
    if (preference == null) {
      return null;
    }
    return t('reminderActions.snoozedAt', {
      time: formatClockTime(remindAt, preference.timeFormat, dateFormatContext),
    });
  };

  const snooze = async (
    todoId: number,
    notificationId: number,
  ): Promise<TodoReminderActionResult> => {
    const remindAt = await snoozeTodoReminder({ todoId, notificationId });
    return {
      outcome: 'succeeded',
      message: t('reminderActions.snoozed', { minutes: TODO_REMINDER_SNOOZE_MINUTES }),
      description: await describeRemindAt(remindAt),
    };
  };

  return async (request: TodoReminderActionRequest) => {
    const epoch = sessionEpoch.current();
    const result = await match(request)
      .with({ type: 'complete' }, ({ todoId, dateKey }) => complete(todoId, dateKey))
      .with({ type: 'snooze' }, ({ todoId, notificationId }) => snooze(todoId, notificationId))
      .exhaustive()
      .catch((error: unknown): TodoReminderActionResult => ({
        outcome: getTodoReminderActionFailure(error),
      }));
    // 기다리는 사이 로그아웃했으면 다음 계정 화면에 안내와 기록을 남기지 않는다
    if (sessionEpoch.current() !== epoch) {
      return;
    }
    match(result)
      .with({ outcome: 'succeeded' }, ({ message, description }) =>
        toast.success(message, description == null ? undefined : { description }),
      )
      .with({ outcome: 'already_completed' }, () =>
        toast.toast(t('reminderActions.alreadyCompleted')),
      )
      // 지운 할 일은 할 일 화면이, 연결 끊김은 상세 조회의 화면 오류나 변경의 전역 오류 피드백이 알렸다
      .with({ outcome: 'not_found' }, { outcome: 'failed' }, noop)
      .exhaustive();
    trackEvent('todo_reminder_action_tapped', { action: request.type, outcome: result.outcome });
  };
}

/**
 * 리마인드 알림의 [완료]. 할 일 완료와 같은 변경이고, 지운 할 일은 방금 연 할 일 화면이
 * 볼 수 없음 안내 하나로 보여 전역 토스트를 더하지 않는다
 */
function useCompleteRemindedTodoMutationOptions() {
  const toggleTodoOptions = useToggleTodoMutationOptions();
  const errorFeedback = toggleTodoOptions.meta?.errorFeedback;

  return mutationOptions({
    ...toggleTodoOptions,
    meta: {
      errorFeedback:
        errorFeedback == null || errorFeedback === false
          ? errorFeedback
          : {
              ...errorFeedback,
              isHandledByFeature: (error) =>
                isTodoUnavailableError(error) ||
                (errorFeedback.isHandledByFeature?.(error) ?? false),
            },
    },
  });
}
