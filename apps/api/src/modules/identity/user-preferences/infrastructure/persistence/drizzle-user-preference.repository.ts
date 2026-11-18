import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, eq, isNull, ne } from "drizzle-orm";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { userConsent, userPreference } from "#api/platform/database/schema/index";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { UserPreferenceRepositoryPort } from "../../application/ports/user-preference.repository.port.js";
import type { UserPreferenceReadModel } from "../../application/read-models/preference.read-model.js";
import type { StreakState } from "../../domain/streak.vo.js";
import type {
  UserPreference,
  UserPreferenceChanges,
} from "../../domain/user-preference.aggregate.js";
import { toUserPreference, toUserPreferenceReadModel } from "./user-preference-row.mapper.js";

@Injectable()
export class DrizzleUserPreferenceRepository extends UserPreferenceRepositoryPort {
  readonly #transactionHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(transactionHost: TransactionHost<DrizzleTransactionalAdapter>) {
    super();
    this.#transactionHost = transactionHost;
  }

  async getByUserId(userId: UserId): Promise<UserPreference> {
    const preference = await this.#db.query.userPreference.findFirst({
      where: { userId: userId.value },
    });
    const consent = await this.#db.query.userConsent.findFirst({
      where: { userId: userId.value },
    });
    return toUserPreference(userId.value, {
      preference: preference ?? null,
      consent: consent ?? null,
    });
  }

  async findReadModelByUserId(userId: UserId): Promise<UserPreferenceReadModel | null> {
    const row = await this.#db.query.userPreference.findFirst({
      where: { userId: userId.value },
    });
    return row == null ? null : toUserPreferenceReadModel(row);
  }

  async findReadModelsByUserIds(userIds: readonly UserId[]): Promise<UserPreferenceReadModel[]> {
    if (userIds.length === 0) {
      return [];
    }
    const rows = await this.#db.query.userPreference.findMany({
      where: { userId: { in: userIds.map((userId) => userId.value) } },
    });
    return rows.map(toUserPreferenceReadModel);
  }

  async save(preference: UserPreference): Promise<boolean> {
    const userId = preference.id.value;
    if (preference.isNew()) {
      const { settings, streak, consent } = preference.toPrimitives();
      await this.#db.insert(userPreference).values({ userId, ...settings, ...streak });
      await this.#db.insert(userConsent).values(consent);
      return true;
    }
    const changes = preference.changesSinceLoad();
    if (!(await this.#saveSettings(userId, changes))) {
      return false;
    }
    await this.#saveConsent(userId, changes.consent);
    return true;
  }

  async refreshTimezoneIfChanged(userId: UserId, timezone: string): Promise<number> {
    const updated = await this.#db
      .update(userPreference)
      .set({ timezone })
      .where(and(eq(userPreference.userId, userId.value), ne(userPreference.timezone, timezone)))
      .returning({ id: userPreference.id });
    return updated.length;
  }

  // 바뀐 칸만 넣거나 바꿔 다른 요청이 쓴 칸을 덮지 않는다. 연속 완료는 읽은 값일 때만 쓴다
  async #saveSettings(
    userId: string,
    changes: Pick<UserPreferenceChanges, "settings" | "streak">,
  ): Promise<boolean> {
    const columns = { ...changes.settings, ...changes.streak?.next };
    if (Object.keys(columns).length === 0) {
      return true;
    }
    const saved = await this.#db
      .insert(userPreference)
      .values({ userId, ...columns })
      .onConflictDoUpdate({
        target: userPreference.userId,
        set: columns,
        setWhere: changes.streak == null ? undefined : streakEquals(changes.streak.loaded),
      })
      .returning({ id: userPreference.id });
    return saved.length > 0;
  }

  async #saveConsent(userId: string, changes: UserPreferenceChanges["consent"]): Promise<void> {
    if (Object.keys(changes).length === 0) {
      return;
    }
    await this.#db
      .insert(userConsent)
      .values({ userId, ...changes })
      .onConflictDoUpdate({ target: userConsent.userId, set: changes });
  }

  get #db() {
    return this.#transactionHost.tx;
  }
}

function streakEquals(streak: StreakState) {
  return and(
    eq(userPreference.currentStreak, streak.currentStreak),
    eq(userPreference.longestStreak, streak.longestStreak),
    streak.lastCompletedDate == null
      ? isNull(userPreference.lastCompletedDate)
      : eq(userPreference.lastCompletedDate, streak.lastCompletedDate),
  );
}
