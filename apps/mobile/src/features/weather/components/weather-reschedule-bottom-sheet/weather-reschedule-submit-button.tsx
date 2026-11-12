import { useLogger } from '@src/bootstrap/providers/di-context';
import type { Todo } from '@src/features/planning/todo/domains/todo.model';
import { invalidateTodos } from '@src/features/planning/todo/queries/todo-cache';
import { useGetTodosByDateQueryOptions } from '@src/features/planning/todo/queries/todo.queries';
import { useTrack } from '@src/shared/analytics';
import { getNowInstant } from '@src/shared/date/clock';
import { getErrorMessage } from '@src/shared/errors';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import { useMutationErrorFeedback } from '@src/shared/query/use-mutation-error-feedback';
import { Button } from '@src/shared/ui';
import { useAppToast } from '@src/shared/ui/toast/use-app-toast';
import { useMutation, useQueryClient, useSuspenseQueries } from '@tanstack/react-query';
import { type UseFormReturn, useFormState, useWatch } from 'react-hook-form';

import { WEATHER_LOG_EVENT } from '../../constants/weather-log-events';
import { WeatherReschedulePolicy } from '../../domains/weather-reschedule.model';
import {
  useWeatherRescheduleReason,
  useWeatherRescheduleTodoIds,
} from '../../hooks/use-weather-reschedule-params';
import { invalidateWeatherReports } from '../../queries/weather-cache';
import { useRescheduleTodoMutationOptions } from '../../queries/weather.mutations';
import {
  useGetWeatherReportQueryOptions,
  WeatherReportSelect,
} from '../../queries/weather.queries';
import type { WeatherRescheduleFormValues } from '../../schemas/weather-reschedule-form.schema';
import {
  toRescheduleOutcome,
  toScheduleChanges,
  toSelectionKey,
} from '../../utils/weather-reschedule-form.view-model';

/** 할 일마다 뜨는 저장 토스트 대신 한 번에 옮긴 결과와 되돌리기를 보여 준다. 실패도 이 버튼이 모아 한 번만 알린다. */
export function WeatherRescheduleSubmitButton({
  form,
  onDone,
}: {
  form: UseFormReturn<WeatherRescheduleFormValues>;
  onDone: () => void;
}) {
  const { t } = useTranslation(['weather', 'todo']);
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const { timeZone } = useDateFormatContext();
  const showMutationError = useMutationErrorFeedback();
  const logger = useLogger();
  const { trackEvent } = useTrack();
  const [todoIds] = useWeatherRescheduleTodoIds();
  const [reason] = useWeatherRescheduleReason();
  const { isSubmitting } = useFormState({ control: form.control });
  const todayKey = useTodayKey();
  // 시트 목록이 같은 조회를 먼저 받아 두어 보통은 바로 읽힌다
  const [{ data: report }, { data: todoList }] = useSuspenseQueries({
    queries: [
      { ...useGetWeatherReportQueryOptions(), select: WeatherReportSelect.briefing },
      useGetTodosByDateQueryOptions({ date: todayKey }),
    ],
  });
  const updateSchedule = useMutation(useRescheduleTodoMutationOptions());
  const todayTodos = todoList.todos;
  // shouldUnregister 폼은 남은 선택이 없으면 selections 자체를 지운다.
  const selections = useWatch({ control: form.control, name: 'selections' }) ?? {};
  const targetCount = WeatherReschedulePolicy.getRescheduleTargets(
    toScheduleChanges({ selections }, todoIds),
    todayTodos,
  ).length;

  const refreshAndReportFailures = (failures: unknown[]) => {
    invalidateTodos(queryClient);
    // 영향받는 할 일은 서버가 고르므로 옮긴 할 일이 브리핑에서 빠지려면 리포트를 다시 받는다
    invalidateWeatherReports(queryClient);
    // 여러 할 일을 한 번에 옮겨 실패는 첫 번째 하나로 한 번만 알린다
    const [firstFailure] = failures;
    if (firstFailure != null) {
      showMutationError(firstFailure, {
        feature: 'weather',
        fallbackKey: 'todo:toast.updateFailedRetry',
      });
    }
  };

  const handleUndo = async (todos: Todo[]) => {
    const results = await Promise.allSettled(
      todos.map((todo) =>
        updateSchedule.mutateAsync({
          todoId: todo.id,
          input: WeatherReschedulePolicy.getOriginalScheduleInput(todo),
        }),
      ),
    );
    const { moved: restored, failures } = toRescheduleOutcome(
      todos.map((todo) => ({ todo })),
      results,
    );
    refreshAndReportFailures(failures);
    if (restored.length > 0) {
      trackEvent('weather_reschedule_undone', { moved_count: restored.length, reason });
      toast.success(t('weather:reschedule.undone'));
    }
  };

  const handleApply = form.handleSubmit(async (values) => {
    const targets = WeatherReschedulePolicy.getRescheduleTargets(
      toScheduleChanges(values, todoIds),
      todayTodos,
    );
    const now = getNowInstant();
    const expired = WeatherReschedulePolicy.getExpiredTargets(targets, now);
    if (expired.length > 0) {
      // 시트를 연 채 정시를 넘겼다. 지난 시각으로 옮기지 않고 다음 유효 후보로 바꿔 다시 확인받는다
      for (const { todo } of expired) {
        const next = WeatherReschedulePolicy.findNextRescheduleOption(report.briefing, {
          todoId: todo.id,
          now,
        });
        if (next != null) {
          form.setValue(`selections.${toSelectionKey(todo.id)}`, next.startsAt);
        }
      }
      toast.warning(t('weather:reschedule.expired'));
      return;
    }
    const results = await Promise.allSettled(
      targets.map(({ todo, startsAt }) =>
        updateSchedule.mutateAsync({
          todoId: todo.id,
          input: WeatherReschedulePolicy.getMovedScheduleInput(todo, startsAt, timeZone),
        }),
      ),
    );
    const { moved, failures } = toRescheduleOutcome(targets, results);
    refreshAndReportFailures(failures);
    if (moved.length === 0) {
      return;
    }
    trackEvent('weather_reschedule_applied', { moved_count: moved.length, reason });
    toast.success(t('weather:reschedule.moved', { count: moved.length }), {
      action: {
        label: t('weather:reschedule.undo'),
        onPress: () => {
          handleUndo(moved).catch((error) => {
            logger.warn(WEATHER_LOG_EVENT.RESCHEDULE_UNDO_FAILED, {
              error: getErrorMessage(error),
            });
          });
        },
      },
    });
    onDone();
  });

  return (
    <Button
      display="full"
      size="xlarge"
      isLoading={isSubmitting}
      isDisabled={targetCount === 0}
      onPress={() => handleApply()}
    >
      {t('weather:reschedule.submit', { count: targetCount })}
    </Button>
  );
}

WeatherRescheduleSubmitButton.Loading = function Loading() {
  const { t } = useTranslation('weather');

  return (
    <Button display="full" size="xlarge" isDisabled>
      {t('reschedule.submit', { count: 0 })}
    </Button>
  );
};
