import { router, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { z } from 'zod';

/** `?todoIds=12,15` — 비와 겹쳐 옮길 할 일 id 목록 */
export const rescheduleTodoIdsParamSchema = z.object({
  todoIds: z
    .string()
    .transform((value) => value.split(',').map(Number))
    .pipe(z.array(z.int().positive()).min(1)),
});

export function toRescheduleTodoIdsParam(todoIds: readonly number[]): string {
  return todoIds.join(',');
}

export function createWeatherRescheduleHref(todoIds: readonly number[]) {
  return {
    pathname: '/weather/reschedule',
    params: { todoIds: toRescheduleTodoIdsParam(todoIds) },
  } as const;
}

export function useRescheduleTodoIdsParam() {
  const { todoIds } = rescheduleTodoIdsParamSchema.parse(useLocalSearchParams());
  const setTodoIds = useCallback(
    (next: readonly number[]) => router.setParams({ todoIds: toRescheduleTodoIdsParam(next) }),
    [],
  );
  return [todoIds, setTodoIds] as const;
}
