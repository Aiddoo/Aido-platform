import type { UserLocalePreferenceReaderPort } from "#api/modules/ai-assistance/ai-generations/application/ports/user-locale-preference.reader.port";
import type { UserLocalePreferenceReadModel } from "#api/modules/ai-assistance/ai-generations/application/read-models/user-locale-preference.read-model";
import type { UpcomingTodoReaderPort } from "#api/modules/ai-assistance/parsed-drafts/application/ports/upcoming-todo.reader.port";
import type { UserCategoryReaderPort } from "#api/modules/ai-assistance/parsed-drafts/application/ports/user-category.reader.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

// failWith를 두면 다음 조회 한 번이 그 오류로 실패한다
export class StubAiUserCategoryReader implements UserCategoryReaderPort {
  readonly categories = new Map<string, Array<{ id: number; name: string }>>();
  readCount = 0;
  failWith: Error | null = null;
  async findByUserId(userId: UserId): Promise<Array<{ id: number; name: string }>> {
    this.readCount += 1;
    const failure = this.failWith;
    if (failure != null) {
      this.failWith = null;
      throw failure;
    }
    return (this.categories.get(userId.value) ?? []).map((category) => ({ ...category }));
  }
}

export class StubUpcomingTodoReader implements UpcomingTodoReaderPort {
  todos: Awaited<ReturnType<UpcomingTodoReaderPort["findByUserId"]>> = [];
  async findByUserId() {
    return this.todos;
  }
}

// failWith를 두면 다음 조회 한 번이 그 오류로 실패한다
export class StubUserLocalePreferenceReader implements UserLocalePreferenceReaderPort {
  readonly preferences = new Map<string, UserLocalePreferenceReadModel>();
  readCount = 0;
  failWith: Error | null = null;
  async read(userId: UserId): Promise<UserLocalePreferenceReadModel> {
    this.readCount += 1;
    const failure = this.failWith;
    if (failure != null) {
      this.failWith = null;
      throw failure;
    }
    return this.preferences.get(userId.value) ?? { timezone: "UTC", locale: "ko" };
  }
}
