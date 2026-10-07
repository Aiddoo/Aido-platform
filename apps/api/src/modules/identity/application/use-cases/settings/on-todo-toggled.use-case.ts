import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { addDays, subtractDays } from "#api/shared/domain/date/utils/arithmetic";
import { startOfDay } from "#api/shared/domain/date/utils/range";
import { todayInTimezone } from "#api/shared/domain/date/utils/timezone";

import { UserPreference } from "../../../domain/aggregates/settings/user-preference.aggregate.js";
import type { StreakCompletionPlan } from "../../../domain/value-objects/settings/streak.vo.js";
import { IdentitySettingsLogEvent } from "../../observability/settings/identity-settings-log.events.js";
import type { StreakMilestoneNotifierPort } from "../../ports/settings/streak-milestone.notifier.port.js";
import type { TodoCompletionStatsReaderPort } from "../../ports/settings/todo-completion-stats.reader.port.js";
import type { UserPreferenceRepositoryPort } from "../../ports/settings/user-preference.repository.port.js";

const MAX_STREAK_UPDATE_ATTEMPTS = 3;

export interface OnTodoToggledInput {
  readonly userId: string;
  readonly completed: boolean;
  readonly timezone?: string;
}

interface OnTodoToggledDependencies {
  readonly preferenceRepository: Pick<
    UserPreferenceRepositoryPort,
    "findByUserId" | "updateStreakIfUnchanged"
  >;
  readonly statsReader: Pick<TodoCompletionStatsReaderPort, "countForDay">;
  readonly milestoneNotifier: Pick<StreakMilestoneNotifierPort, "notifyStreak3Reached">;
  readonly logger: ApplicationLogger;
}

export class OnTodoToggled {
  readonly #dependencies: OnTodoToggledDependencies;

  constructor(dependencies: OnTodoToggledDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: OnTodoToggledInput): Promise<void> {
    try {
      const today = todayInTimezone(input.timezone ?? "UTC");
      for (let attempt = 0; attempt < MAX_STREAK_UPDATE_ATTEMPTS; attempt += 1) {
        const stats = await this.#statsForDay(input.userId, today);
        if (stats.total === 0) {
          return;
        }

        const record = await this.#dependencies.preferenceRepository.findByUserId(input.userId);
        if (record === null) {
          return;
        }

        const preference = UserPreference.reconstitute(record);
        const allCompleted = stats.total === stats.completed;
        const plan = await this.#planTransition(input.userId, preference, today, allCompleted);
        if (plan === null) {
          return;
        }

        const updated = await this.#dependencies.preferenceRepository.updateStreakIfUnchanged(
          input.userId,
          preference.streakState,
          plan.nextState,
        );
        if (!updated) {
          continue;
        }

        if (plan.reachedStreak3) {
          this.#dependencies.milestoneNotifier.notifyStreak3Reached(input.userId);
        }
        this.#dependencies.logger.log({
          event: allCompleted
            ? IdentitySettingsLogEvent.STREAK_UPDATED
            : IdentitySettingsLogEvent.STREAK_RECALCULATED,
          userId: input.userId,
          currentStreak: plan.nextState.currentStreak,
          longestStreak: plan.nextState.longestStreak,
        });
        return;
      }

      this.#dependencies.logger.warn({
        event: IdentitySettingsLogEvent.STREAK_UPDATE_CONFLICT,
        userId: input.userId,
        attempts: MAX_STREAK_UPDATE_ATTEMPTS,
      });
    } catch (error) {
      // Todo의 커밋된 변경은 스트릭 갱신 실패로 되돌리지 않는다.
      this.#dependencies.logger.error({
        event: IdentitySettingsLogEvent.STREAK_UPDATE_FAILED,
        userId: input.userId,
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
    }
  }

  async #statsForDay(userId: string, date: Date) {
    const dayStart = startOfDay(date);
    return this.#dependencies.statsReader.countForDay(userId, dayStart, addDays(1, dayStart));
  }

  async #planTransition(
    userId: string,
    preference: UserPreference,
    today: Date,
    allCompleted: boolean,
  ): Promise<StreakCompletionPlan | null> {
    if (allCompleted) {
      return preference.planTodoCompletion(today);
    }
    if (!preference.hasTodoCompletionOn(today)) {
      return null;
    }

    const yesterdayStats = await this.#statsForDay(userId, subtractDays(1, today));
    const hadYesterdayCompletion =
      yesterdayStats.total > 0 && yesterdayStats.total === yesterdayStats.completed;
    const nextState = preference.planTodoUncompletion(today, hadYesterdayCompletion);
    return nextState === null ? null : { nextState, reachedStreak3: false };
  }
}
