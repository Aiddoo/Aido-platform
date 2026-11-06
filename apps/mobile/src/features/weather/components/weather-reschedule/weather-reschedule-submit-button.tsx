import { useLogger } from '@src/bootstrap/providers/di-context';
import type { Todo } from '@src/features/planning/todo/domains/todo.model';
import { useGetTodosByDateQueryOptions } from '@src/features/planning/todo/queries/get-todos-by-date-query-options';
import { useTrack } from '@src/shared/analytics';
import { getErrorMessage } from '@src/shared/errors';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import { Button } from '@src/shared/ui';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useFormContext, useFormState, useWatch } from 'react-hook-form';

import { WEATHER_LOG_EVENT } from '../../constants/weather-log-events';
import {
  toMovedScheduleInput,
  toOriginalScheduleInput,
  toRescheduleTargets,
  type WeatherRescheduleFormValues,
} from '../../domains/weather-reschedule-form.schema';
import { useWeatherRescheduleParams } from '../../hooks/use-weather-reschedule-params';
import { useRescheduleTodoMutationOptions } from '../../queries/use-reschedule-todo-mutation-options';

/** 할 일마다 뜨는 저장 토스트 대신 한 번에 옮긴 결과와 되돌리기를 보여 준다. 실패는 원래 오류 토스트가 알린다. */
export function WeatherRescheduleSubmitButton({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation('weather');
  const toast = useAppToast();
  const logger = useLogger();
  const { trackEvent } = useTrack();
  const [{ todoIds, reason }] = useWeatherRescheduleParams();
  const { handleSubmit, control } = useFormContext<WeatherRescheduleFormValues>();
  const { isSubmitting } = useFormState({ control });
  const { data: todoList } = useQuery(useGetTodosByDateQueryOptions({ date: useTodayKey() }));
  const updateSchedule = useMutation(useRescheduleTodoMutationOptions());
  const todayTodos = todoList?.todos ?? [];
  // shouldUnregister 폼은 남은 선택이 없으면 selections 자체를 지운다.
  const selections = useWatch({ control, name: 'selections' }) ?? {};
  const hasTargets = toRescheduleTargets({ selections }, todoIds, todayTodos).length > 0;

  const handleUndo = async (todos: Todo[]) => {
    const results = await Promise.allSettled(
      todos.map((todo) =>
        updateSchedule.mutateAsync({ todoId: todo.id, input: toOriginalScheduleInput(todo) }),
      ),
    );
    const restoredCount = results.filter((result) => result.status === 'fulfilled').length;
    if (restoredCount > 0) {
      trackEvent('weather_reschedule_undone', { moved_count: restoredCount, reason });
      toast.success(t('reschedule.undone'));
    }
  };

  const handleApply = handleSubmit(async (values) => {
    const targets = toRescheduleTargets(values, todoIds, todayTodos);
    const results = await Promise.allSettled(
      targets.map(({ todo, startsAt }) =>
        updateSchedule.mutateAsync({
          todoId: todo.id,
          input: toMovedScheduleInput(todo, startsAt),
        }),
      ),
    );
    const moved = targets
      .filter((_, index) => results[index]?.status === 'fulfilled')
      .map(({ todo }) => todo);
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
      isDisabled={!hasTargets}
      onPress={() => handleApply()}
    >
      {t('reschedule.submit', { count: todoIds.length })}
    </Button>
  );
}
