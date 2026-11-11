import { Inject, Injectable } from "@nestjs/common";

import { UserStreakAccessPort } from "#api/modules/identity/identity-settings.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { StreakPort } from "../../application/ports/streak.port.js";

/**
 * todo의 스트릭 포트를 user-settings의 공개 capability에 연결한다.
 */
@Injectable()
export class StreakAdapter implements StreakPort {
  readonly #userStreakAccess: UserStreakAccessPort;

  constructor(
    @Inject(UserStreakAccessPort)
    userStreakAccess: UserStreakAccessPort,
  ) {
    this.#userStreakAccess = userStreakAccess;
  }

  async recordTodoToggle(userId: UserId, completed: boolean, timezone: string): Promise<void> {
    await this.#userStreakAccess.recordTodoToggle(userId, completed, timezone);
  }

  async getStreakContext(userId: UserId): Promise<{
    currentStreak: number;
    lastCompletedDate: Temporal.PlainDate | null;
  }> {
    const record = await this.#userStreakAccess.getPreferenceRecord(userId);
    return {
      currentStreak: record?.currentStreak ?? 0,
      lastCompletedDate: record?.lastCompletedDate ?? null,
    };
  }
}
