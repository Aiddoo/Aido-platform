import { WEATHER_RESCHEDULE_REASONS, type WeatherRescheduleReason } from '@aido/api/vocabulary';
import { type Instant, toEpochMs } from '@src/shared/date/instant';
import { keyBy } from 'es-toolkit';
import { z } from 'zod';

import {
  createWeatherAffectedTodos,
  weatherAffectedTodoSchema,
  type WeatherForecastTodo,
} from './weather-briefing.model';
import type { WeatherReportBriefing } from './weather-report-briefing.model';

/** 날씨를 피해 옮기기 한 건: 무엇을 피하는지와 옮길 후보 할 일(서버 순서) */
const weatherRescheduleSchema = z.object({
  reason: z.enum(WEATHER_RESCHEDULE_REASONS),
  todos: z.array(weatherAffectedTodoSchema),
});
export type WeatherReschedule = z.infer<typeof weatherRescheduleSchema>;

export interface ScheduleChange {
  todoId: number;
  startsAt: Instant;
}

interface RescheduleTarget<TTodo> {
  todo: TTodo;
  startsAt: Instant;
}

interface WeatherRescheduleSource {
  // 서버가 판단하지 못했으면 null이다
  reportBriefing: WeatherReportBriefing | null;
  forecastTodos: readonly WeatherForecastTodo[];
  // 링크(브리핑 카드·알림)가 가리킨 할 일과 이유
  linkedTodoIds: readonly number[];
  linkedReason: WeatherRescheduleReason;
}

/** 링크의 이유가 달라졌거나 낡아도 지금 브리핑을 따른다. 서버가 판단하지 못했으면 앱이 다시 판단하지 않고 비운다 */
export function createWeatherReschedule({
  reportBriefing,
  forecastTodos,
  linkedTodoIds,
  linkedReason,
}: WeatherRescheduleSource): WeatherReschedule {
  if (reportBriefing == null) {
    return { reason: linkedReason, todos: [] };
  }
  const affected = createWeatherAffectedTodos(reportBriefing, forecastTodos).filter(
    (todo) => !todo.completed,
  );
  const linked = affected.filter((todo) => linkedTodoIds.includes(todo.todoId));
  return {
    reason: reportBriefing.reason ?? linkedReason,
    todos: linked.length > 0 ? linked : affected,
  };
}

/** 시트를 연 사이 지워졌거나 완료된 할 일(다른 기기·알림 동작)은 옮기지 않는다 */
export function getRescheduleTargets<TTodo extends { id: number; completed: boolean }>(
  changes: readonly ScheduleChange[],
  todos: readonly TTodo[],
): RescheduleTarget<TTodo>[] {
  const todosById = keyBy(todos, (todo) => todo.id);
  return changes.flatMap(({ todoId, startsAt }) => {
    const todo = todosById[todoId];
    return todo == null || todo.completed ? [] : [{ todo, startsAt }];
  });
}

/** 시트를 연 채 정시를 넘겨 이미 지난 시각이 된 선택. 지난 시각으로는 옮기지 않는다. */
export function getExpiredTargets<TTodo>(
  targets: readonly RescheduleTarget<TTodo>[],
  now: Instant,
): RescheduleTarget<TTodo>[] {
  return targets.filter(({ startsAt }) => toEpochMs(startsAt) <= toEpochMs(now));
}

export const WeatherReschedulePolicy = {
  /** 그 할 일 하나를 뺀 나머지. 남은 것이 없으면 옮길 것이 없다 */
  getTodoIdsWithout(reschedule: WeatherReschedule, todoId: number) {
    return reschedule.todos.flatMap((todo) => (todo.todoId === todoId ? [] : [todo.todoId]));
  },
};
