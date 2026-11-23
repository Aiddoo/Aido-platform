import { isAllCompleted } from "@aido/api/vocabulary";

import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { localDateIn } from "#api/shared/domain/time/timezone-name";

import type { UserPreference } from "../../domain/user-preference.aggregate.js";
import type { StreakMilestoneNotifierPort } from "../ports/streak-milestone-notifier.port.js";
import type {
  DatedTodoCompletionStats,
  TodoCompletionStatsReaderPort,
} from "../ports/todo-completion-stats.reader.port.js";
import type { UserPreferenceRepositoryPort } from "../ports/user-preference.repository.port.js";
import { UserPreferenceLogEvent } from "../user-preferences.log-events.js";

const MAX_STREAK_UPDATE_ATTEMPTS = 3;

export interface OnTodoToggledCommand {
  readonly userId: string;
  readonly completed: boolean;
  readonly timezone?: string;
  readonly todayStats?: DatedTodoCompletionStats;
}

interface OnTodoToggledDependencies {
  readonly preferenceRepository: Pick<UserPreferenceRepositoryPort, "getByUserId" | "save">;
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
      // 같은 날 현황이 넘어왔으면 첫 시도는 그 값을 쓰고, CAS 충돌 뒤에는 최신 값을 다시 읽는다
      const givenTodayStats = input.todayStats?.date.equals(today) ? input.todayStats : undefined;
      // 충돌은 오류가 아니라 false로 오고 다 쓰면 경고만 남겨 es-toolkit retry(오류 재시도·시도 사이 타이머)를 쓰지 않는다
      for (let attempt = 0; attempt < MAX_STREAK_UPDATE_ATTEMPTS; attempt += 1) {
        const stats =
          (attempt === 0 ? givenTodayStats : undefined) ?? (await this.#statsForDay(userId, today));
        if (stats.total === 0) {
          return;
        }

        // 설정 행이 없는 옛 사용자는 연속 완료를 세지 않는다
        const preference = await this.#dependencies.preferenceRepository.getByUserId(userId);
        if (!preference.isStreakTracked()) {
          return;
        }

        const allCompleted = isAllCompleted(stats.completed, stats.total);
        if (!(await this.#recordTransition(preference, today, allCompleted))) {
          return;
        }

        // 연속 완료만 읽은 값 조건으로 쓴다. 그사이 다른 반영이 저장했으면 false라 다시 읽는다
        if (!(await this.#dependencies.preferenceRepository.save(preference))) {
          continue;
        }

        if (allCompleted && preference.hasReachedStreakMilestone()) {
          await this.#dependencies.milestoneNotifier.notifyStreak3Reached(userId);
        }
        this.#dependencies.logger.log({
          event: allCompleted
            ? UserPreferenceLogEvent.STREAK_UPDATED
            : UserPreferenceLogEvent.STREAK_RECALCULATED,
          userId: input.userId,
          currentStreak: preference.streakState?.currentStreak,
          longestStreak: preference.streakState?.longestStreak,
        });
        return;
      }

      this.#dependencies.logger.warn({
        event: UserPreferenceLogEvent.STREAK_UPDATE_CONFLICT,
        userId: input.userId,
        attempts: MAX_STREAK_UPDATE_ATTEMPTS,
      });
    } catch (error) {
      // Todo의 커밋된 변경은 스트릭 갱신 실패로 되돌리지 않는다.
      this.#dependencies.logger.error({
        event: UserPreferenceLogEvent.STREAK_UPDATE_FAILED,
        userId: input.userId,
        errorType: toErrorType(error),
      });
    }
  }

  async #statsForDay(userId: UserId, date: Temporal.PlainDate) {
    return this.#dependencies.statsReader.countForDay(userId, date);
  }

  // 설정 Aggregate의 id가 사용자 id다
  async #recordTransition(
    preference: UserPreference,
    today: Temporal.PlainDate,
    allCompleted: boolean,
  ): Promise<boolean> {
    if (allCompleted) {
      return preference.recordAllTodosCompleted(today);
    }
    if (!preference.hasTodoCompletionOn(today)) {
      return false;
    }

    const yesterdayStats = await this.#statsForDay(preference.userId, today.subtract({ days: 1 }));
    const hadYesterdayCompletion = isAllCompleted(yesterdayStats.completed, yesterdayStats.total);
    return preference.recordTodoReopened(today, hadYesterdayCompletion);
  }
}
