import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { localDateIn } from "#api/shared/domain/time/time-zone-name";

import type { StreakCompletionPlan } from "../../domain/streak.vo.js";
import type { UserPreference } from "../../domain/user-preference.aggregate.js";
import type { StreakMilestoneNotifierPort } from "../ports/streak-milestone-notifier.port.js";
import type { TodoCompletionStatsReaderPort } from "../ports/todo-completion-stats.reader.port.js";
import type { UserPreferenceRepositoryPort } from "../ports/user-preference.repository.port.js";
import { PreferenceLogEvent } from "../preferences.log-events.js";

const MAX_STREAK_UPDATE_ATTEMPTS = 3;

export interface OnTodoToggledCommand {
  readonly userId: string;
  readonly completed: boolean;
  readonly timezone?: string;
}

interface OnTodoToggledDependencies {
  readonly preferenceRepository: Pick<
    UserPreferenceRepositoryPort,
    "findStreakByUserId" | "updateStreakIfUnchanged"
  >;
  readonly statsReader: Pick<TodoCompletionStatsReaderPort, "countForDay">;
  readonly milestoneNotifier: Pick<StreakMilestoneNotifierPort, "notifyStreak3Reached">;
  readonly clock: ClockPort;
  readonly logger: ApplicationLoggerPort;
}

export class OnTodoToggledUseCase {
  readonly #dependencies: OnTodoToggledDependencies;

  constructor(dependencies: OnTodoToggledDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: OnTodoToggledCommand): Promise<void> {
    const userId = UserId.reconstitute(input.userId);
    try {
      const today = localDateIn(this.#dependencies.clock.now(), input.timezone);
      // 충돌은 오류가 아니라 false로 오고 다 쓰면 경고만 남겨 es-toolkit retry(오류 재시도·시도 사이 타이머)를 쓰지 않는다
      for (let attempt = 0; attempt < MAX_STREAK_UPDATE_ATTEMPTS; attempt += 1) {
        const stats = await this.#statsForDay(userId, today);
        if (stats.total === 0) {
          return;
        }

        const preference = await this.#dependencies.preferenceRepository.findStreakByUserId(userId);
        if (preference == null) {
          return;
        }

        const allCompleted = stats.total === stats.completed;
        const plan = await this.#planTransition(userId, preference, today, allCompleted);
        if (plan == null) {
          return;
        }

        const updated = await this.#dependencies.preferenceRepository.updateStreakIfUnchanged(
          userId,
          preference.streakState,
          plan.nextState,
        );
        if (!updated) {
          continue;
        }

        if (plan.reachedStreak3) {
          this.#dependencies.milestoneNotifier.notifyStreak3Reached(userId);
        }
        this.#dependencies.logger.log({
          event: allCompleted
            ? PreferenceLogEvent.STREAK_UPDATED
            : PreferenceLogEvent.STREAK_RECALCULATED,
          userId: input.userId,
          currentStreak: plan.nextState.currentStreak,
          longestStreak: plan.nextState.longestStreak,
        });
        return;
      }

      this.#dependencies.logger.warn({
        event: PreferenceLogEvent.STREAK_UPDATE_CONFLICT,
        userId: input.userId,
        attempts: MAX_STREAK_UPDATE_ATTEMPTS,
      });
    } catch (error) {
      // Todo의 커밋된 변경은 스트릭 갱신 실패로 되돌리지 않는다.
      this.#dependencies.logger.error({
        event: PreferenceLogEvent.STREAK_UPDATE_FAILED,
        userId: input.userId,
        errorType: toErrorType(error),
      });
    }
  }

  async #statsForDay(userId: UserId, date: Temporal.PlainDate) {
    return this.#dependencies.statsReader.countForDay(userId, date);
  }

  async #planTransition(
    userId: UserId,
    preference: UserPreference,
    today: Temporal.PlainDate,
    allCompleted: boolean,
  ): Promise<StreakCompletionPlan | null> {
    if (allCompleted) {
      return preference.planTodoCompletion(today);
    }
    if (!preference.hasTodoCompletionOn(today)) {
      return null;
    }

    const yesterdayStats = await this.#statsForDay(userId, today.subtract({ days: 1 }));
    const hadYesterdayCompletion =
      yesterdayStats.total > 0 && yesterdayStats.total === yesterdayStats.completed;
    const nextState = preference.planTodoUncompletion(today, hadYesterdayCompletion);
    return nextState == null ? null : { nextState, reachedStreak3: false };
  }
}
