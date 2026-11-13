import { appendSortOrders } from "../../../shared/domain/todo-sort-order.domain-service.js";
import type { TodoReminderSchedulerPort } from "../../../todos/application/ports/todo-reminder-scheduler.port.js";
import type {
  CreatedOccurrence,
  TodoRepositoryPort,
} from "../../../todos/application/ports/todo.repository.port.js";
import type { ApplyTodoEventsUseCase } from "../../../todos/application/use-cases/apply-todo-events.use-case.js";
import { occurrenceHorizon } from "../../domain/occurrence-horizon.domain-service.js";
import { TodoOccurrencesCreatedEvent } from "../../domain/todo-occurrences-created.event.js";
import type { TodoSeries, TodoOccurrenceDraft } from "../../domain/todo-series.aggregate.js";

/**
 * 한 번에 만드는 회차 상한. 아주 먼 과거에서 시작하는 규칙이 한 트랜잭션에 몰리지 않게 하고,
 * 남은 회차는 커서에 남아 다음 회차 채우기가 이어서 만든다.
 */
export const MAX_OCCURRENCES_PER_RUN = 400;

interface TodoOccurrenceMaterializerDependencies {
  readonly todoRepository: Pick<
    TodoRepositoryPort,
    "getMaxSortOrder" | "nextIds" | "insertOccurrences"
  >;
  readonly todoReminder: Pick<TodoReminderSchedulerPort, "scheduleReminders">;
  readonly applyTodoEvents: Pick<ApplyTodoEventsUseCase, "execute">;
}

/**
 * 규칙의 커서부터 미리 만드는 기간까지 회차를 실제 행으로 만든다. 저장은 활성 UoW 안에서 한다.
 * 커서가 앞으로 가면 다음 실행은 같은 회차를 다시 만들지 않으므로 리마인더 작업도 행과 함께 커밋한다.
 */
export class MaterializeTodoOccurrencesUseCase {
  readonly #dependencies: TodoOccurrenceMaterializerDependencies;

  constructor(dependencies: TodoOccurrenceMaterializerDependencies) {
    this.#dependencies = dependencies;
  }

  /** 기간 안의 회차를 계획한다. 먼 미래에 시작하는 새 규칙도 첫 회차는 바로 보여야 한다. */
  planFirstRun(series: TodoSeries, now: Temporal.Instant): TodoOccurrenceDraft[] {
    const horizon = occurrenceHorizon(series.timezone, now);
    const next = series.nextOccurrenceDate;
    const through = next != null && next > horizon ? next : horizon;
    return series.planOccurrences(through, MAX_OCCURRENCES_PER_RUN);
  }

  planDueRun(series: TodoSeries, now: Temporal.Instant): TodoOccurrenceDraft[] {
    series.skipDormantGap(now);
    return series.planOccurrences(occurrenceHorizon(series.timezone, now), MAX_OCCURRENCES_PER_RUN);
  }

  async persist(
    series: TodoSeries,
    drafts: readonly TodoOccurrenceDraft[],
  ): Promise<readonly CreatedOccurrence[]> {
    if (drafts.length === 0) {
      return [];
    }
    const { todoRepository } = this.#dependencies;
    const userId = series.userId.value;
    const maxSortOrder = await todoRepository.getMaxSortOrder(series.userId);
    // 회차 id를 한 문장으로 먼저 받는다
    const ids = await todoRepository.nextIds(drafts.length);
    const sortOrders = appendSortOrders(maxSortOrder, drafts.length);
    const created = await todoRepository.insertOccurrences(
      drafts.flatMap((draft, index) => {
        const id = ids[index];
        const sortOrder = sortOrders[index];
        return id == null || sortOrder == null ? [] : [{ ...draft, id, sortOrder }];
      }),
      series.id,
      series.checklistTemplate,
    );
    await this.#dependencies.todoReminder.scheduleReminders(
      created.flatMap(({ todoId, scheduledTime }) =>
        scheduledTime == null ? [] : [{ todoId, scheduledTime, userId }],
      ),
    );
    if (created.length > 0) {
      await this.#dependencies.applyTodoEvents.execute([
        new TodoOccurrencesCreatedEvent(series.id.value, userId, created.length),
      ]);
    }
    return created;
  }
}
