import type { AiQuotaUserMutationLockPort } from "#api/modules/access/application/ports/quotas/ai-quota-user-mutation-lock.port";
import type {
  AiQuotaRepositoryPort,
  AiQuotaState,
} from "#api/modules/access/application/ports/quotas/ai-quota.repository.port";
import type { UserCategoryReaderPort } from "#api/modules/ai-assistance/application/ports/parsing/user-category-reader.port";
import type {
  UserLocalePreference,
  UserLocalePreferenceReaderPort,
} from "#api/modules/ai-assistance/application/ports/parsing/user-locale-preference.reader.port";

export class StubAiQuotaRepository implements AiQuotaRepositoryPort {
  readonly users = new Map<string, AiQuotaState>();
  async findQuotaState(userId: string): Promise<AiQuotaState | null> {
    const state = this.users.get(userId);
    return state === undefined ? null : { ...state, resetAt: new Date(state.resetAt) };
  }
  async saveUsage(userId: string, usage: { count: number; resetAt: Date }): Promise<void> {
    const state = this.users.get(userId);
    if (state !== undefined)
      this.users.set(userId, { ...state, count: usage.count, resetAt: new Date(usage.resetAt) });
  }
  async releaseUsage(
    userId: string,
    input: { count: number; expectedResetAt: Date },
  ): Promise<boolean> {
    const state = this.users.get(userId);
    if (
      state === undefined ||
      state.count <= 0 ||
      state.resetAt.getTime() !== input.expectedResetAt.getTime()
    )
      return false;
    this.users.set(userId, { ...state, count: input.count });
    return true;
  }
}

export class StubAiQuotaUserMutationLock implements AiQuotaUserMutationLockPort {
  constructor(readonly repository: StubAiQuotaRepository) {}
  async lockById(userId: string): Promise<boolean> {
    return this.repository.users.has(userId);
  }
}

export class StubAiUserCategoryReader implements UserCategoryReaderPort {
  readonly categories = new Map<string, Array<{ id: number; name: string }>>();
  async findByUserId(userId: string): Promise<Array<{ id: number; name: string }>> {
    return (this.categories.get(userId) ?? []).map((category) => ({ ...category }));
  }
}

export class StubUserLocalePreferenceReader implements UserLocalePreferenceReaderPort {
  readonly preferences = new Map<string, UserLocalePreference>();
  readCount = 0;
  async read(userId: string): Promise<UserLocalePreference> {
    this.readCount += 1;
    return this.preferences.get(userId) ?? { timezone: "UTC", locale: "ko" };
  }
}
