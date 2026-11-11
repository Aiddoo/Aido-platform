import { TodoOwnerTimezonePort } from "#api/modules/planning/todos/application/ports/todo-owner-timezone.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

export class StubTodoOwnerTimezone extends TodoOwnerTimezonePort {
  readonly timezones: Map<string, string>;

  constructor(timezones: Map<string, string> = new Map()) {
    super();
    this.timezones = timezones;
  }

  async findTimezone(userId: UserId): Promise<string | null> {
    return this.timezones.get(userId.value) ?? null;
  }
}
