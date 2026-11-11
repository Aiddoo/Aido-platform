import type { ApplyTodoCompletionEffectsUseCase } from "#api/modules/planning/todos/application/use-cases/apply-todo-completion-effects.use-case";
import type { DomainEvent } from "#api/shared/domain/model/domain-event";

export class RecordingTodoCompletionEffects implements Pick<
  ApplyTodoCompletionEffectsUseCase,
  "execute"
> {
  readonly events: DomainEvent[] = [];

  async execute(events: readonly DomainEvent[]): Promise<void> {
    this.events.push(...events);
  }
}
