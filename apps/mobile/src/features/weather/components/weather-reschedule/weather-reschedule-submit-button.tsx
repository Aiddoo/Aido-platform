import { useHaptics, useLogger } from '@src/bootstrap/providers/di-context';
import { invalidateTodos } from '@src/features/planning/todo/queries/todo-cache';
import { useGetTodosByDateQueryOptions } from '@src/features/planning/todo/queries/todo.queries';
import type { Todo } from '@src/features/planning/todo/schemas/todo.schema';
import { useTrack } from '@src/shared/analytics';
import { getErrorMessage, getUserFacingMessage } from '@src/shared/errors';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { t as translate, useTranslation } from '@src/shared/i18n';
import { Button } from '@src/shared/ui';
import { useAppToast } from '@src/shared/ui/toast/use-app-toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type UseFormReturn, useFormState, useWatch } from 'react-hook-form';

import { WEATHER_LOG_EVENT } from '../../constants/weather-log-events';
import { WeatherReschedulePolicy } from '../../domains/weather-reschedule.model';
import { useWeatherRescheduleParams } from '../../hooks/use-weather-reschedule-params';
import { useRescheduleTodoMutationOptions } from '../../queries/weather.mutations';
import type { WeatherRescheduleFormValues } from '../../schemas/weather-reschedule-form.schema';
import { toRescheduleOutcome, toScheduleChanges } from '../../utils/weather-reschedule-form';

/** 할 일마다 뜨는 저장 토스트 대신 한 번에 옮긴 결과와 되돌리기를 보여 준다. 실패는 원래 오류 토스트가 알린다. */
export function WeatherRescheduleSubmitButton({
  form,
  onDone,
}: {
  form: UseFormReturn<WeatherRescheduleFormValues>;
  onDone: () => void;
}) {
  const { t } = useTranslation('weather');
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const { timeZone } = useDateFormatContext();
  const haptics = useHaptics();
  const logger = useLogger();
  const { trackEvent } = useTrack();
  const [{ todoIds, reason }] = useWeatherRescheduleParams();
  const { isSubmitting } = useFormState({ control: form.control });
  const { data: todoList } = useQuery(useGetTodosByDateQueryOptions({ date: useTodayKey() }));
  const updateSchedule = useMutation(useRescheduleTodoMutationOptions());
  const todayTodos = todoList?.todos ?? [];
  // shouldUnregister 폼은 남은 선택이 없으면 selections 자체를 지운다.
  const selections = useWatch({ control: form.control, name: 'selections' }) ?? {};
  const targetCount = WeatherReschedulePolicy.getRescheduleTargets(
    toScheduleChanges({ selections }, todoIds),
    todayTodos,
  ).length;

  const settle = (failures: unknown[]) => {
    invalidateTodos(queryClient);
    const [firstFailure] = failures;
    if (failures.length > 0) {
      haptics.notify('error');
      toast.error(getUserFacingMessage(firstFailure), {
        fallback: translate('todo:toast.updateFailedRetry'),
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
    settle(failures);
    if (restored.length > 0) {
      trackEvent('weather_reschedule_undone', { moved_count: restored.length, reason });
      toast.success(t('reschedule.undone'));
    }
  };

  const handleApply = form.handleSubmit(async (values) => {
    const targets = WeatherReschedulePolicy.getRescheduleTargets(
      toScheduleChanges(values, todoIds),
      todayTodos,
    );
    const results = await Promise.allSettled(
      targets.map(({ todo, startsAt }) =>
        updateSchedule.mutateAsync({
          todoId: todo.id,
          input: WeatherReschedulePolicy.getMovedScheduleInput(todo, startsAt, timeZone),
        }),
      ),
    );
    const { moved, failures } = toRescheduleOutcome(targets, results);
    settle(failures);
    if (moved.length === 0) {
      return;
    }
    trackEvent('weather_reschedule_applied', { moved_count: moved.length, reason });
    toast.success(t('reschedule.moved', { count: moved.length }), {
      action: {
        label: t('reschedule.undo'),
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
      {t('reschedule.submit', { count: targetCount })}
    </Button>
  );
}
