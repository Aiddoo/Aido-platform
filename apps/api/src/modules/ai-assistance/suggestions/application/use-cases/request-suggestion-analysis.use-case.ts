import {
  type EntitlementReaderPort,
  premiumFeatureDenied,
} from "#api/modules/access/feature-grants/access-feature-grants.public";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { SuggestionAnalysisRun } from "../../domain/suggestion-analysis-run.entity.js";
import { hasEnoughRecentTodos } from "../../domain/suggestion-analysis-state.domain-service.js";
import { suggestionDispatchLocalDate } from "../../domain/suggestion-dispatch-window.domain-service.js";
import type { OnDemandSuggestionAnalysisConfigPort } from "../ports/on-demand-suggestion-analysis-config.port.js";
import type { SuggestionAnalysisEnqueuerPort } from "../ports/suggestion-analysis-enqueuer.port.js";
import type { SuggestionAnalysisRunRepositoryPort } from "../ports/suggestion-analysis-run.repository.port.js";
import type { SuggestionRepositoryPort } from "../ports/suggestion.repository.port.js";
import type {
  RecentTodoCountReadModel,
  SuggestionAnalysisReadModel,
} from "../read-models/suggestion-analysis.read-model.js";
import { SuggestionLockKeys } from "../suggestions.lock-keys.js";
import { SuggestionLogEvent } from "../suggestions.log-events.js";
import type { CountRecentSuggestionTodosUseCase } from "./count-recent-suggestion-todos.use-case.js";
import type { GetSuggestionAnalysisStateUseCase } from "./get-suggestion-analysis-state.use-case.js";

export interface RequestSuggestionAnalysisCommand {
  readonly userId: string;
}

interface RequestSuggestionAnalysisDependencies {
  readonly entitlementReader: Pick<EntitlementReaderPort, "can">;
  readonly onDemandConfig: Pick<OnDemandSuggestionAnalysisConfigPort, "isEnabled">;
  readonly runs: Pick<SuggestionAnalysisRunRepositoryPort, "findByUserId" | "save">;
  readonly suggestions: Pick<SuggestionRepositoryPort, "listPendingByUserId">;
  readonly enqueuer: Pick<SuggestionAnalysisEnqueuerPort, "enqueue">;
  readonly analysisState: Pick<GetSuggestionAnalysisStateUseCase, "execute">;
  readonly countRecentTodos: Pick<CountRecentSuggestionTodosUseCase, "execute">;
  readonly unitOfWork: Pick<UnitOfWorkPort, "run">;
  readonly mutationLock: Pick<MutationLockPort, "acquire">;
  readonly clock: ClockPort;
  readonly logger: Pick<ApplicationLoggerPort, "log" | "warn">;
}

export class RequestSuggestionAnalysisUseCase {
  readonly #dependencies: RequestSuggestionAnalysisDependencies;

  constructor(dependencies: RequestSuggestionAnalysisDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: RequestSuggestionAnalysisCommand): Promise<SuggestionAnalysisReadModel> {
    const userId = UserId.reconstitute(command.userId);
    if (!(await this.#dependencies.entitlementReader.can(userId, "AI_SUGGESTION"))) {
      this.#dependencies.logger.warn({
        event: SuggestionLogEvent.PREMIUM_DENIED,
        userId: userId.value,
      });
      throw premiumFeatureDenied("AI_SUGGESTION");
    }
    if (!this.#dependencies.onDemandConfig.isEnabled) {
      this.#dependencies.logger.log({
        event: SuggestionLogEvent.ANALYSIS_DISABLED,
        userId: userId.value,
      });
      return this.#readState(userId);
    }
    const now = this.#dependencies.clock.now();
    // 아침 배치와 같은 날짜를 쓰려고 요청 헤더가 아니라 저장된 시간대로 정한다
    const recentTodos = await this.#dependencies.countRecentTodos.execute({ userId, now });
    if (!hasEnoughRecentTodos(recentTodos.recentTodoCount)) {
      return this.#readState(userId, recentTodos);
    }
    const job = {
      userId,
      localDate: suggestionDispatchLocalDate({ at: now, timeZone: recentTodos.timeZone }),
      trigger: "ON_DEMAND",
      timeZone: recentTodos.timeZone,
    } as const;
    const requested = await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.mutationLock.acquire([SuggestionLockKeys.analysisRun(userId)]);
      const run = await this.#dependencies.runs.findByUserId(userId);
      if (run != null && !run.request({ ...job, now })) {
        return false;
      }
      await this.#dependencies.runs.save(run ?? SuggestionAnalysisRun.create({ ...job, now }));
      await this.#dependencies.enqueuer.enqueue(job);
      return true;
    });
    this.#dependencies.logger.log({
      event: requested
        ? SuggestionLogEvent.ANALYSIS_REQUESTED
        : SuggestionLogEvent.ANALYSIS_DEDUPLICATED,
      userId: userId.value,
      trigger: job.trigger,
    });
    return this.#readState(userId, recentTodos);
  }

  async #readState(
    userId: UserId,
    recentTodos?: RecentTodoCountReadModel,
  ): Promise<SuggestionAnalysisReadModel> {
    const pending = await this.#dependencies.suggestions.listPendingByUserId(
      userId,
      this.#dependencies.clock.now(),
    );
    return this.#dependencies.analysisState.execute({
      userId,
      pendingCount: pending.length,
      recentTodos,
    });
  }
}
