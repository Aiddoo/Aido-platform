import { type MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";

import { resolveScheduledInstant } from "../../../shared/domain/todo-calendar.domain-service.js";
import type { TodoOccurrenceWriterPort } from "../../../todos/application/ports/todo-occurrence-writer.port.js";
import type { TodoReminderSchedule } from "../../../todos/application/ports/todo-reminder-scheduler.port.js";
import { TodoLockKeys } from "../../../todos/application/todos.lock-keys.js";
import { TodoId } from "../../../todos/domain/todo-id.vo.js";
import { occurrenceHorizon } from "../../domain/occurrence-horizon.domain-service.js";
import { planOccurrenceRemap } from "../../domain/occurrence-remap.domain-service.js";
import type { TodoSeries } from "../../domain/todo-series.aggregate.js";

export interface RemapFollowingOccurrencesInput {
  readonly pivotTodoId: number;
  readonly source: TodoSeries;
  readonly following: readonly TodoSeries[];
  readonly target: TodoSeries;
  readonly pivot: Temporal.PlainDate;
  readonly now: Temporal.Instant;
}

export interface RemappedOccurrences {
  readonly deletedTodoIds: readonly number[];
  readonly movedTodoIds: readonly number[];
  readonly reminders: readonly TodoReminderSchedule[];
  readonly responseTodoId: number;
}

interface RemapFollowingOccurrencesDependencies {
  readonly occurrenceWriter: Pick<
    TodoOccurrenceWriterPort,
    "findOccurrencesFrom" | "deleteMany" | "moveOccurrence" | "reassignOccurrences"
  >;
  readonly mutationLock: MutationLockPort;
}

// 이후 모두 고치기에서 규칙이 바뀌면 이후 회차 행을 새 규칙 날짜에 맞춘다. 뒤 구간의 행도 같은 기준으로 합친다.
// 활성 UoW 안에서 UpdateFollowingTodosUseCase가 부른다
export class RemapFollowingOccurrencesUseCase {
  readonly #dependencies: RemapFollowingOccurrencesDependencies;

  constructor(dependencies: RemapFollowingOccurrencesDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: RemapFollowingOccurrencesInput): Promise<RemappedOccurrences> {
    const { pivotTodoId, source, following, target, pivot, now } = input;
    const { occurrenceWriter } = this.#dependencies;
    const rows = await occurrenceWriter.findOccurrencesFrom(
      [source, ...following].map((segment) => segment.id),
      pivot.toString(),
    );
    const lastRow = rows.at(-1);
    const lastRowDate = lastRow == null ? pivot : Temporal.PlainDate.from(lastRow.occurrenceDate);
    const horizon = occurrenceHorizon(target.timezone, now);
    const through = Temporal.PlainDate.compare(lastRowDate, horizon) > 0 ? lastRowDate : horizon;
    const dates = target.rule.occurrencesBetween({
      seriesStart: target.startDate,
      from: pivot,
      through,
    });
    const plan = planOccurrenceRemap({
      rows,
      dates: dates.map((date) => date.toString()),
      pivotTodoId,
      sourceSeriesId: source.id.value,
    });
    if (plan.responseTodoId !== pivotTodoId) {
      // EditTodoUseCase가 이어서 응답 회차를 할 일 잠금으로 고친다. 옮기기가 그 행을 잠그기 전에 잡아, 할 일 잠금 → 행 순서로
      // 기다리는 완료 토글과 엇갈리지 않게 한다. 사용자 순서 잠금 아래라 할 일 잠금끼리는 순서가 엇갈리지 않는다
      await this.#dependencies.mutationLock.acquire([TodoLockKeys.todo(plan.responseTodoId)]);
    }
    // 유니크 인덱스 때문에 자리를 비운 뒤 기준 회차를 옮긴다
    await occurrenceWriter.deleteMany(
      plan.deletedTodoIds.map((todoId) => TodoId.reconstitute(todoId)),
    );

    const movedTodoIds: number[] = [];
    const reminders: TodoReminderSchedule[] = [];
    if (plan.pivotMoveDate != null) {
      const localTime = target.scheduledLocalTime;
      const scheduledTime = resolveScheduledInstant(plan.pivotMoveDate, localTime, target.timezone);
      const pivotId = TodoId.reconstitute(pivotTodoId);
      await occurrenceWriter.moveOccurrence(pivotId, {
        occurrenceDate: plan.pivotMoveDate,
        scheduledLocalTime: localTime,
        scheduledTime,
      });
      movedTodoIds.push(pivotTodoId);
      if (scheduledTime != null) {
        reminders.push({ todoId: pivotId, scheduledTime, userId: target.userId });
      }
    }

    const deleted = new Set(plan.deletedTodoIds);
    const reassigned = plan.keep
      .filter((row) => row.seriesId !== target.id.value && !deleted.has(row.todoId))
      .map((row) => row.todoId);
    await occurrenceWriter.reassignOccurrences(
      (target === source ? reassigned : [...reassigned, ...movedTodoIds]).map((todoId) =>
        TodoId.reconstitute(todoId),
      ),
      target.id,
    );
    return {
      deletedTodoIds: plan.deletedTodoIds,
      movedTodoIds,
      reminders,
      responseTodoId: plan.responseTodoId,
    };
  }
}
