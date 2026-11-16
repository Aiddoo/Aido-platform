import type { SuggestionAnalysisRunRepositoryPort } from "#api/modules/ai-assistance/suggestions/application/ports/suggestion-analysis-run.repository.port";
import type { SuggestionAnalysisRun } from "#api/modules/ai-assistance/suggestions/domain/suggestion-analysis-run.entity";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  createSuggestionAnalysisRunFixture,
  SUGGESTION_ANALYSIS_RUN_FIXTURE_TODAY,
} from "#test/fixtures/ai-assistance/suggestion-analysis-run.fixture";
import {
  SUGGESTION_FIXTURE_NOW,
  SUGGESTION_FIXTURE_OTHER_USER_ID,
  SUGGESTION_FIXTURE_USER_ID,
} from "#test/fixtures/ai-assistance/suggestion.fixture";

const USER_ID = UserId.reconstitute(SUGGESTION_FIXTURE_USER_ID);
const OTHER_USER_ID = UserId.reconstitute(SUGGESTION_FIXTURE_OTHER_USER_ID);
const UNKNOWN_USER_ID = UserId.reconstitute("clz7x5p8k0003qz0z8z8z8z8z");
const STARTED_AT = SUGGESTION_FIXTURE_NOW.add({ seconds: 3 });
const FINISHED_AT = SUGGESTION_FIXTURE_NOW.add({ seconds: 40 });
const FINISHED = {
  status: "FINISHED",
  trigger: "ON_DEMAND",
  outcome: "SUGGESTIONS_CREATED",
  recentTodoCount: 12,
  createdSuggestionCount: 2,
  startedAt: STARTED_AT,
  finishedAt: FINISHED_AT,
} as const;

function toSortedPrimitives(runs: readonly SuggestionAnalysisRun[]) {
  return runs
    .map((run) => run.toPrimitives())
    .toSorted((left, right) => left.userId.localeCompare(right.userId));
}

export function describeSuggestionAnalysisRunRepositoryContract(
  createRepository: () => Promise<SuggestionAnalysisRunRepositoryPort>,
): void {
  describe("제안 분석 실행 저장소 계약", () => {
    it.each([
      ["큐에 넣은", {}],
      ["분석 중인", { status: "RUNNING", startedAt: STARTED_AT }],
      ["끝난", FINISHED],
    ] as const)("%s 실행을 저장하면 주인에게 같은 값으로 읽힌다", async (_title, overrides) => {
      // Given
      const repository = await createRepository();
      const run = createSuggestionAnalysisRunFixture(overrides);

      // When
      await repository.save(run);
      const found = await repository.findByUserId(USER_ID);
      const foreign = await repository.findByUserId(OTHER_USER_ID);

      // Then
      expect(found?.toPrimitives()).toEqual(run.toPrimitives());
      expect(foreign).toBeNull();
    });

    it("여러 사용자의 실행을 한 번에 저장하고 읽으며, 기록 없는 사용자는 빠진다", async () => {
      // Given
      const repository = await createRepository();
      const runs = [
        createSuggestionAnalysisRunFixture(),
        createSuggestionAnalysisRunFixture({
          ...FINISHED,
          userId: SUGGESTION_FIXTURE_OTHER_USER_ID,
        }),
      ];

      // When
      await repository.saveMany(runs);
      const found = await repository.listByUserIds([USER_ID, OTHER_USER_ID, UNKNOWN_USER_ID]);

      // Then
      expect(toSortedPrimitives(found)).toEqual(toSortedPrimitives(runs));
      expect(await repository.listByUserIds([])).toEqual([]);
    });

    it("같은 사용자 실행을 다시 저장하면 모든 칸을 덮어쓴다", async () => {
      // Given
      const repository = await createRepository();
      await repository.save(createSuggestionAnalysisRunFixture());
      const finished = createSuggestionAnalysisRunFixture(FINISHED);
      const requestedNextDay = createSuggestionAnalysisRunFixture(FINISHED);
      requestedNextDay.request({
        localDate: SUGGESTION_ANALYSIS_RUN_FIXTURE_TODAY.add({ days: 1 }),
        trigger: "SCHEDULED",
        now: FINISHED_AT.add({ hours: 24 }),
      });

      // When
      await repository.saveMany([finished]);
      const afterSaveMany = await repository.findByUserId(USER_ID);
      await repository.save(requestedNextDay);
      const afterSave = await repository.findByUserId(USER_ID);

      // Then
      expect(afterSaveMany?.toPrimitives()).toEqual(finished.toPrimitives());
      expect(afterSave?.toPrimitives()).toEqual(requestedNextDay.toPrimitives());
    });
  });
}
