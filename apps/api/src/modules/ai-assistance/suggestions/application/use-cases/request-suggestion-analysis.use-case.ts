import {
  type EntitlementReaderPort,
  premiumFeatureDenied,
} from "#api/modules/access/entitlements/access-entitlements.public";
import type { UserTimezoneReaderPort } from "#api/modules/identity/identity-settings.public";
import type { SingleTodoCountReaderPort } from "#api/modules/planning/todos/planning-todo-queries.public";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { SuggestionAnalysisRun } from "../../domain/suggestion-analysis-run.entity.js";
import {
  resolveSuggestionTimeZone,
  suggestionAnalysisPeriod,
  suggestionDispatchLocalDate,
} from "../../domain/suggestion-dispatch-window.domain-service.js";
import { AiSuggestionLogEvent } from "../ai-suggestion.log-events.js";
import type { SuggestionAnalysisEnqueuerPort } from "../ports/suggestion-analysis-enqueuer.port.js";
import type { SuggestionAnalysisRunRepositoryPort } from "../ports/suggestion-analysis-run.repository.port.js";
import type { SuggestionAnalysisSettingsPort } from "../ports/suggestion-analysis-settings.port.js";
import type { SuggestionRepositoryPort } from "../ports/suggestion.repository.port.js";
import type { SuggestionAnalysisReadModel } from "../read-models/suggestion-analysis.read-model.js";
import type { SuggestionAnalysisStateReader } from "../suggestion-analysis-state.reader.js";
import { SuggestionLockKeys } from "../suggestions.lock-keys.js";

export interface RequestSuggestionAnalysisCommand {
  readonly userId: string;
}

interface RequestSuggestionAnalysisDependencies {
  readonly entitlementReader: Pick<EntitlementReaderPort, "can">;
  readonly settings: Pick<SuggestionAnalysisSettingsPort, "onDemandEnabled">;
  readonly timezoneReader: Pick<UserTimezoneReaderPort, "findStoredTimezone">;
  readonly todoCountReader: Pick<SingleTodoCountReaderPort, "countSingleTodos">;
  readonly runs: Pick<SuggestionAnalysisRunRepositoryPort, "findByUserId" | "save">;
  readonly suggestions: Pick<SuggestionRepositoryPort, "listPendingByUserId">;
  readonly enqueuer: Pick<SuggestionAnalysisEnqueuerPort, "enqueue">;
  readonly analysisState: Pick<SuggestionAnalysisStateReader, "read">;
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
        event: AiSuggestionLogEvent.PREMIUM_DENIED,
        userId: userId.value,
      });
      throw premiumFeatureDenied("AI_SUGGESTION");
    }
    if (!this.#dependencies.settings.onDemandEnabled) {
      this.#dependencies.logger.log({
        event: AiSuggestionLogEvent.ANALYSIS_DISABLED,
        userId: userId.value,
      });
      return this.#readState(userId);
    }
    const now = this.#dependencies.clock.now();
    // 아침 배치와 같은 날짜를 쓰려고 요청 헤더가 아니라 저장된 시간대로 정한다
    const timeZone = resolveSuggestionTimeZone(
      await this.#dependencies.timezoneReader.findStoredTimezone(userId),
    );
    const recentTodoCount = await this.#dependencies.todoCountReader.countSingleTodos({
      userId,
      ...suggestionAnalysisPeriod({ at: now, timeZone }),
    });
    if (recentTodoCount === 0) {
      return this.#readState(userId);
    }
    const job = {
      userId,
      localDate: suggestionDispatchLocalDate({ at: now, timeZone }),
      trigger: "ON_DEMAND",
      timeZone,
      weatherGrid: null,
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
        ? AiSuggestionLogEvent.ANALYSIS_REQUESTED
        : AiSuggestionLogEvent.ANALYSIS_DEDUPLICATED,
      userId: userId.value,
      trigger: job.trigger,
    });
    return this.#readState(userId);
  }

  async #readState(userId: UserId): Promise<SuggestionAnalysisReadModel> {
    const pending = await this.#dependencies.suggestions.listPendingByUserId(
      userId,
      this.#dependencies.clock.now(),
    );
    return this.#dependencies.analysisState.read(userId, pending.length);
  }
}
