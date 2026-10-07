import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { addDays, subtractDays } from "#api/shared/domain/date/utils/arithmetic";
import { startOfDay } from "#api/shared/domain/date/utils/range";
import { todayInTimezone } from "#api/shared/domain/date/utils/timezone";

import { UserPreference } from "../../../domain/aggregates/settings/user-preference.aggregate.js";
import { type StreakMilestoneNotifierPort } from "../../ports/settings/streak-milestone.notifier.port.js";
import { type TodoCompletionStatsReaderPort } from "../../ports/settings/todo-completion-stats.reader.port.js";
import { type UserPreferenceRepositoryPort } from "../../ports/settings/user-preference.repository.port.js";

/**
 * 투두 완료 토글 시 스트릭 갱신 유스케이스.
 *
 * 전체 완료 → 스트릭 증가(3일 도달 시 마일스톤 알림), 완료 취소 → 재계산.
 * todo 어댑터가 fire-and-forget으로 호출하며, 실패는 삼켜 로깅한다.
 */
interface OnTodoToggledDependencies {
  readonly preferenceRepository: UserPreferenceRepositoryPort;
  readonly statsReader: TodoCompletionStatsReaderPort;
  readonly milestoneNotifier: StreakMilestoneNotifierPort;
  readonly logger: ApplicationLogger;
}

export class OnTodoToggled {
  readonly #dependencies: OnTodoToggledDependencies;

  constructor(dependencies: OnTodoToggledDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(userId: string, completed: boolean, tz: string = "UTC"): Promise<void> {
    try {
      const today = todayInTimezone(tz);
      const stats = await this.#statsForDay(userId, today);

      if (stats.total === 0) {
        return;
      }

      const allCompleted = stats.total === stats.completed;

      if (completed && allCompleted) {
        await this.#onAllCompleted(userId, today);
      } else if (!completed) {
        await this.#onUncompleted(userId, today);
      }
    } catch (error) {
      this.#dependencies.logger.error(
        `Failed to update streak: userId=${userId}, error=${error}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  async #statsForDay(userId: string, date: Date) {
    const dayStart = startOfDay(date);
    const dayEnd = addDays(1, dayStart);
    return this.#dependencies.statsReader.countForDay(userId, dayStart, dayEnd);
  }

  async #onAllCompleted(userId: string, today: Date): Promise<void> {
    const pref = await this.#dependencies.preferenceRepository.findByUserId(userId);
    if (!pref) {
      return;
    }

    const preference = UserPreference.reconstitute(pref);
    const plan = preference.planTodoCompletion(today);
    if (!plan) {
      return;
    }

    await this.#dependencies.preferenceRepository.updateStreak(userId, plan.nextState);

    if (plan.reachedStreak3) {
      this.#dependencies.milestoneNotifier.notifyStreak3Reached(userId);
    }

    this.#dependencies.logger.log(
      `Streak updated: userId=${userId}, streak=${plan.nextState.currentStreak}, longest=${plan.nextState.longestStreak}`,
    );
  }

  async #onUncompleted(userId: string, today: Date): Promise<void> {
    const pref = await this.#dependencies.preferenceRepository.findByUserId(userId);
    if (!pref) {
      return;
    }

    const preference = UserPreference.reconstitute(pref);
    if (!preference.hasTodoCompletionOn(today)) {
      return;
    }

    const yesterday = subtractDays(1, today);
    const yesterdayStats = await this.#statsForDay(userId, yesterday);
    const hadYesterdayCompletion =
      yesterdayStats.total > 0 && yesterdayStats.total === yesterdayStats.completed;

    const nextState = preference.planTodoUncompletion(today, hadYesterdayCompletion);
    if (!nextState) {
      return;
    }

    await this.#dependencies.preferenceRepository.updateStreak(userId, nextState);
    this.#dependencies.logger.log(`Streak recalculated on uncomplete: userId=${userId}`);
  }
}
