import { resolveScheduledInstant } from "../../../shared/domain/todo-calendar.domain-service.js";
import type { TodoOccurrenceWriterPort } from "../../../todos/application/ports/todo-occurrence-writer.port.js";
import type { TodoReminderSchedule } from "../../../todos/application/ports/todo-reminder-scheduler.port.js";
import { TodoId } from "../../../todos/domain/todo-id.vo.js";
import { occurrenceHorizon } from "../../domain/occurrence-horizon.domain-service.js";
import { planOccurrenceRemap } from "../../domain/occurrence-remap.domain-service.js";
import type { TodoSeries } from "../../domain/todo-series.aggregate.js";

export interface RemapFollowingOccurrencesInput {
  readonly pivotTodoId: number;
  readonly source: TodoSeries;
  readonly following: readonly TodoSeries[];
  readonly target: TodoSeries;
  readonly pivot: string;
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
      pivot,
    );
    const lastRowDate = rows.at(-1)?.occurrenceDate ?? pivot;
    const horizon = occurrenceHorizon(target.timezone, now);
    const through = lastRowDate > horizon ? lastRowDate : horizon;
    const plan = planOccurrenceRemap({
      rows,
      dates: target.rule.occurrencesBetween(target.startDate, pivot, through, 0),
      pivotTodoId,
      sourceSeriesId: source.id.value,
    });
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
