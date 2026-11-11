import type {
  UserLocalePreference,
  UserLocalePreferenceReaderPort,
} from "#api/modules/ai-assistance/generation/application/ports/user-locale-preference.reader.port";
import type { UpcomingTodoReaderPort } from "#api/modules/ai-assistance/parsing/application/ports/upcoming-todo.reader.port";
import type { UserCategoryReaderPort } from "#api/modules/ai-assistance/parsing/application/ports/user-category.reader.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

export class StubAiUserCategoryReader implements UserCategoryReaderPort {
  readonly categories = new Map<string, Array<{ id: number; name: string }>>();
  async findByUserId(userId: UserId): Promise<Array<{ id: number; name: string }>> {
    return (this.categories.get(userId.value) ?? []).map((category) => ({ ...category }));
  }
}

export class StubUpcomingTodoReader implements UpcomingTodoReaderPort {
  todos: Awaited<ReturnType<UpcomingTodoReaderPort["findByUserId"]>> = [];
  async findByUserId() {
    return this.todos;
  }
}

export class StubUserLocalePreferenceReader implements UserLocalePreferenceReaderPort {
  readonly preferences = new Map<string, UserLocalePreference>();
  readCount = 0;
  async read(userId: UserId): Promise<UserLocalePreference> {
    this.readCount += 1;
    return this.preferences.get(userId.value) ?? { timezone: "UTC", locale: "ko" };
  }
}
