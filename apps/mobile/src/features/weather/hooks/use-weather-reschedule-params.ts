import type { WeatherRescheduleReason } from '@aido/api';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';

import {
  rescheduleReasonParamSchema,
  rescheduleTodoIdsParamSchema,
  toRescheduleTodoIdsParam,
} from '../utils/navigation/weather-reschedule-href';

export function useRescheduleReasonParam(): readonly [WeatherRescheduleReason] {
  return [rescheduleReasonParamSchema.parse(useLocalSearchParams()).reason] as const;
}

export function useRescheduleTodoIdsParam() {
  const { todoIds } = rescheduleTodoIdsParamSchema.parse(useLocalSearchParams());
  const setTodoIds = useCallback(
    (next: readonly number[]) => router.setParams({ todoIds: toRescheduleTodoIdsParam(next) }),
    [],
  );
  return [todoIds, setTodoIds] as const;
}
