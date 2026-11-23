import { keyBy } from "es-toolkit";

import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { SuggestionAnalysisRun } from "../../domain/suggestion-analysis-run.entity.js";
import { suggestionDispatchLocalDate } from "../../domain/suggestion-dispatch-window.domain-service.js";
import type {
  SuggestionAnalysisEnqueuerPort,
  SuggestionAnalysisJob,
} from "../ports/suggestion-analysis-enqueuer.port.js";
import type { SuggestionAnalysisRunRepositoryPort } from "../ports/suggestion-analysis-run.repository.port.js";
import { SuggestionLockKeys } from "../suggestions.lock-keys.js";

interface SuggestionAnalysisTarget {
  readonly userId: UserId;
  readonly timeZone: string;
}

export interface DispatchSuggestionAnalysesCommand {
  readonly targets: readonly SuggestionAnalysisTarget[];
}

interface DispatchSuggestionAnalysesDependencies {
  readonly runs: Pick<SuggestionAnalysisRunRepositoryPort, "listByUserIds" | "saveMany">;
  readonly enqueuer: Pick<SuggestionAnalysisEnqueuerPort, "enqueueMany">;
  readonly unitOfWork: Pick<UnitOfWorkPort, "run">;
  readonly mutationLock: Pick<MutationLockPort, "acquire">;
  readonly clock: ClockPort;
}

export class DispatchSuggestionAnalysesUseCase {
  readonly #dependencies: DispatchSuggestionAnalysesDependencies;

  constructor(dependencies: DispatchSuggestionAnalysesDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: DispatchSuggestionAnalysesCommand): Promise<number> {
    if (command.targets.length === 0) {
      return 0;
    }
    const now = this.#dependencies.clock.now();
    const userIds = command.targets.map((target) => target.userId);
    return this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.mutationLock.acquire(
        userIds.map((userId) => SuggestionLockKeys.analysisRun(userId)),
      );
      const runsByUserId = keyBy(
        await this.#dependencies.runs.listByUserIds(userIds),
        (run) => run.id.value,
      );
      const requested = command.targets.flatMap((target) => {
        const job: SuggestionAnalysisJob = {
          ...target,
          localDate: suggestionDispatchLocalDate({ at: now, timeZone: target.timeZone }),
          trigger: "SCHEDULED",
        };
        const run = runsByUserId[target.userId.value];
        if (run == null) {
          return [{ job, run: SuggestionAnalysisRun.create({ ...job, now }) }];
        }
        return run.request({ ...job, now }) ? [{ job, run }] : [];
      });
      await this.#dependencies.runs.saveMany(requested.map(({ run }) => run));
      await this.#dependencies.enqueuer.enqueueMany(requested.map(({ job }) => job));
      return requested.length;
    });
  }
}
