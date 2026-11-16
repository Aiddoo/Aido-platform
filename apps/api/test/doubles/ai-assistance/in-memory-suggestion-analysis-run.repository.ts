import { SuggestionAnalysisRunRepositoryPort } from "#api/modules/ai-assistance/suggestions/application/ports/suggestion-analysis-run.repository.port";
import { SuggestionAnalysisRun } from "#api/modules/ai-assistance/suggestions/domain/suggestion-analysis-run.entity";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

// 저장 사본을 두어 save 없이 바꾼 Entity가 저장소 상태로 새지 않게 한다
function copyOf(run: SuggestionAnalysisRun): SuggestionAnalysisRun {
  return SuggestionAnalysisRun.reconstitute(run.toPrimitives());
}

export class InMemorySuggestionAnalysisRunRepository extends SuggestionAnalysisRunRepositoryPort {
  readonly #runs = new Map<string, SuggestionAnalysisRun>();

  constructor(runs: readonly SuggestionAnalysisRun[] = []) {
    super();
    for (const run of runs) {
      this.#runs.set(run.id.value, copyOf(run));
    }
  }

  async findByUserId(userId: UserId): Promise<SuggestionAnalysisRun | null> {
    const run = this.#runs.get(userId.value);
    return run == null ? null : copyOf(run);
  }

  async listByUserIds(userIds: readonly UserId[]): Promise<SuggestionAnalysisRun[]> {
    return userIds.flatMap((userId) => {
      const run = this.#runs.get(userId.value);
      return run == null ? [] : [copyOf(run)];
    });
  }

  async save(run: SuggestionAnalysisRun): Promise<void> {
    this.#runs.set(run.id.value, copyOf(run));
  }

  async saveMany(runs: readonly SuggestionAnalysisRun[]): Promise<void> {
    for (const run of runs) {
      this.#runs.set(run.id.value, copyOf(run));
    }
  }
}
