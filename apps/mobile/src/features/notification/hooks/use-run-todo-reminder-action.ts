import { TODO_REMINDER_SNOOZE_MINUTES } from '@aido/api/vocabulary';
import { useLogger, useSessionEpoch } from '@src/bootstrap/providers/di-context';
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
import type { DateKey } from '@src/shared/date/date-key';
import { formatClockTime } from '@src/shared/date/format/date-format';
import type { Instant } from '@src/shared/date/instant';
import { getErrorMessage, NetworkError } from '@src/shared/errors';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useTranslation } from '@src/shared/i18n';
import { readWithoutBlocking } from '@src/shared/query/read-without-blocking';
import { useAppToast } from '@src/shared/ui';
import { mutationOptions, onlineManager, useMutation, useQueryClient } from '@tanstack/react-query';
import { noop, TimeoutError as WaitTimeoutError, withTimeout } from 'es-toolkit';
import { match } from 'ts-pattern';

import { NOTIFICATION_LOG_EVENT } from '../constants/notification-log-events';
import { TODO_REMINDER_DETAILS_WAIT_MS } from '../constants/notification.constants';
import { getTodoReminderActionFailure } from '../domains/notification.error';
import type {
  TodoReminderActionOutcome,
  TodoReminderActionRequest,
} from '../domains/push-notification-response.model';
import { useSnoozeTodoReminderMutationOptions } from '../queries/notification.mutations';

/** 성공 안내를 띄울 결과, 연결 안내를 띄울 실패, 안내 없이 분석에만 남기는 결과 */
type TodoReminderActionResult =
  | { outcome: 'succeeded'; message: string; description: string | null }
  | { outcome: 'failed'; notice: 'network' | 'timeout' | null }
  | { outcome: Exclude<TodoReminderActionOutcome, 'succeeded' | 'failed'> };

/**
 * 리마인드 알림 버튼(완료·10분 뒤 다시)으로 할 일을 바꾸고 결과를 알린다. 이미 끝낸 할 일은 부드럽게 알리고,
 * 지운 할 일은 할 일 화면의 볼 수 없음 안내가, 그 밖의 실패는 상세 조회의 화면 오류나 변경의 전역 오류 피드백이 알린다
 */
export function useRunTodoReminderAction(): (request: TodoReminderActionRequest) => Promise<void> {
  const { t } = useTranslation(['notification', 'common']);
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
    isSameSession: () => boolean,
  ): Promise<TodoReminderActionResult> => {
    // 화면이 먼저 연 같은 상세 조회가 오프라인에 멈춰 있으면 networkMode로도 풀리지 않고 그 조회에 합류해
    // 연결되는 순간 완료가 나간다. 오프라인이면 기다리지 않고, 오프라인을 늦게 아는 콜드 스타트는 제한 시간에 끝낸다
    if (!onlineManager.isOnline()) {
      return { outcome: 'failed', notice: 'network' };
    }
    // 다른 기기에서 끝냈을 수 있어 캐시가 아닌 서버 값으로 정한다. 방금 연 할 일 화면과 같은 조회라 요청은 하나다
    const details = await withTimeout(
      () => fetchFreshTodoDetails(queryClient, getTodoDetailsQueryOptions(todoId)),
      TODO_REMINDER_DETAILS_WAIT_MS,
    ).catch((error: unknown) => {
      if (error instanceof WaitTimeoutError) {
        return 'timeout' as const;
      }
      if (error instanceof NetworkError) {
        return 'network' as const;
      }
      throw error;
    });
    if (typeof details === 'string') {
      return { outcome: 'failed', notice: details };
    }
    // 상세를 기다리는 사이 로그아웃했거나 계정이 바뀌었으면 다음 계정으로 완료를 보내지 않는다. 결과는 부르는 쪽이 버린다
    if (!isSameSession()) {
      return { outcome: 'failed', notice: null };
    }
    const { todo } = details;
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
    const isSameSession = () => sessionEpoch.current() === epoch;
    const result = await match(request)
      .with({ type: 'complete' }, ({ todoId, dateKey }) => complete(todoId, dateKey, isSameSession))
      .with({ type: 'snooze' }, ({ todoId, notificationId }) => snooze(todoId, notificationId))
      .exhaustive()
      .catch(toTodoReminderActionFailure);
    // 기다리는 사이 로그아웃했으면 다음 계정 화면에 안내와 기록을 남기지 않는다
    if (!isSameSession()) {
      return;
    }
    match(result)
      .with({ outcome: 'succeeded' }, ({ message, description }) =>
        toast.success(message, description == null ? undefined : { description }),
      )
      .with({ outcome: 'already_completed' }, () =>
        toast.toast(t('reminderActions.alreadyCompleted')),
      )
      // 상세를 받지 못해 완료를 보내지 않았다. 멈춘 화면은 오류를 보이지 않아 여기서 알린다
      .with({ outcome: 'failed', notice: 'network' }, () =>
        toast.warning(t('common:infraErrors.network')),
      )
      .with({ outcome: 'failed', notice: 'timeout' }, () =>
        toast.warning(t('common:infraErrors.timeout')),
      )
      // 지운 할 일은 할 일 화면이, 그 밖의 실패는 상세 조회의 화면 오류나 변경의 전역 오류 피드백이 알렸다
      .with({ outcome: 'not_found' }, { outcome: 'failed', notice: null }, noop)
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

function toTodoReminderActionFailure(error: unknown): TodoReminderActionResult {
  const outcome = getTodoReminderActionFailure(error);
  return outcome === 'failed' ? { outcome, notice: null } : { outcome };
}
