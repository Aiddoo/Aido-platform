import { Inject, Injectable } from "@nestjs/common";

import { UserStreakAccessPort } from "#api/modules/identity/identity-settings.public";
import { instantToDate } from "#api/shared/domain/time/instant";

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

  async recordTodoToggle(userId: string, completed: boolean, timezone: string): Promise<void> {
    await this.#userStreakAccess.recordTodoToggle(userId, completed, timezone);
  }

  async getStreakContext(userId: string): Promise<{
    currentStreak: number;
    lastCompletedDate: Date | null;
  }> {
    const record = await this.#userStreakAccess.getPreferenceRecord(userId);
    const lastCompletedDate = record?.lastCompletedDate ?? null;
    // 요약의 스트릭 판정은 아직 UTC 자정 Date로 계산한다
    return {
      currentStreak: record?.currentStreak ?? 0,
      lastCompletedDate:
        lastCompletedDate == null
          ? null
          : instantToDate(lastCompletedDate.toZonedDateTime("UTC").toInstant()),
    };
  }
}
