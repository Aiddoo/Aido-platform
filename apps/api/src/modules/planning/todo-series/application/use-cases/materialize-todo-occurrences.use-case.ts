import { appendSortOrders } from "../../../shared/domain/todo-sort-order.domain-service.js";
import type {
  CreatedOccurrence,
  TodoOccurrenceWriterPort,
} from "../../../todos/application/ports/todo-occurrence-writer.port.js";
import type { TodoReminderSchedulerPort } from "../../../todos/application/ports/todo-reminder-scheduler.port.js";
import type { TodoRepositoryPort } from "../../../todos/application/ports/todo.repository.port.js";
import type { ApplyTodoEventsUseCase } from "../../../todos/application/use-cases/apply-todo-events.use-case.js";
import type { TodoOccurrenceDraft } from "../../domain/todo-occurrence-draft.domain-service.js";
import type { TodoSeries } from "../../domain/todo-series.aggregate.js";

export interface MaterializeTodoOccurrencesInput {
  readonly series: TodoSeries;
  /** 규칙의 planFirstRun·planDueRun이 만든 초안 */
  readonly drafts: readonly TodoOccurrenceDraft[];
}

interface TodoOccurrenceMaterializerDependencies {
  readonly todoRepository: Pick<TodoRepositoryPort, "getMaxSortOrder">;
  readonly occurrenceWriter: Pick<TodoOccurrenceWriterPort, "nextIds" | "insertOccurrences">;
  readonly todoReminder: Pick<TodoReminderSchedulerPort, "scheduleReminders">;
  readonly applyTodoEvents: Pick<ApplyTodoEventsUseCase, "execute">;
}

/**
 * 규칙이 계획한 회차를 실제 행으로 만들고 규칙이 낸 사실을 함께 반영한다. 저장은 활성 UoW 안에서 한다.
 * 커서가 앞으로 가면 다음 실행은 같은 회차를 다시 만들지 않으므로 리마인더 작업도 행과 함께 커밋한다.
 */
export class MaterializeTodoOccurrencesUseCase {
  readonly #dependencies: TodoOccurrenceMaterializerDependencies;

  constructor(dependencies: TodoOccurrenceMaterializerDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: MaterializeTodoOccurrencesInput): Promise<readonly CreatedOccurrence[]> {
    const { series, drafts } = input;
    const created = await this.#insert(series, drafts);
    await this.#dependencies.todoReminder.scheduleReminders(
      created.flatMap(({ todoId, scheduledTime }) =>
        scheduledTime == null ? [] : [{ todoId, scheduledTime, userId: series.userId }],
      ),
    );
    await this.#dependencies.applyTodoEvents.execute(series.pullDomainEvents());
    return created;
  }

  async #insert(
    series: TodoSeries,
    drafts: readonly TodoOccurrenceDraft[],
  ): Promise<readonly CreatedOccurrence[]> {
    if (drafts.length === 0) {
      return [];
    }
    const { todoRepository, occurrenceWriter } = this.#dependencies;
    const maxSortOrder = await todoRepository.getMaxSortOrder(series.userId);
    // 회차 id를 한 문장으로 먼저 받는다
    const ids = await occurrenceWriter.nextIds(drafts.length);
    const sortOrders = appendSortOrders(maxSortOrder, drafts.length);
    return occurrenceWriter.insertOccurrences(
      drafts.flatMap((draft, index) => {
        const id = ids[index];
        const sortOrder = sortOrders[index];
        return id == null || sortOrder == null ? [] : [{ ...draft, id, sortOrder }];
      }),
      series.id,
      series.checklistTemplate,
    );
  }
}
