import type { SuggestionRepositoryPort } from "#api/modules/ai-assistance/suggestions/application/ports/suggestion.repository.port";
import type {
  Suggestion,
  SuggestionPrimitives,
} from "#api/modules/ai-assistance/suggestions/domain/suggestion.aggregate";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  createSuggestionFixture,
  SUGGESTION_FIXTURE_NOW,
  SUGGESTION_FIXTURE_OTHER_USER_ID,
  SUGGESTION_FIXTURE_USER_ID,
} from "#test/fixtures/ai-assistance/suggestion.fixture";

const USER_ID = UserId.reconstitute(SUGGESTION_FIXTURE_USER_ID);
const OTHER_USER_ID = UserId.reconstitute(SUGGESTION_FIXTURE_OTHER_USER_ID);
const NOW = SUGGESTION_FIXTURE_NOW.add({ hours: 1 });
const FUTURE = SUGGESTION_FIXTURE_NOW.add({ hours: 24 * 14 });
const PAST = SUGGESTION_FIXTURE_NOW.subtract({ hours: 1 });

async function saveSuggestions(
  repository: SuggestionRepositoryPort,
  overrides: readonly Partial<SuggestionPrimitives>[],
): Promise<Suggestion[]> {
  const ids = await repository.nextIds(overrides.length);
  const suggestions = overrides.map((override, index) =>
    createSuggestionFixture({ expiresAt: FUTURE, ...override, id: ids[index]?.value ?? 0 }),
  );
  await repository.saveMany(suggestions);
  return suggestions;
}

export function describeSuggestionRepositoryContract(
  createRepository: () => Promise<SuggestionRepositoryPort>,
): void {
  describe("반복 제안 저장소 계약", () => {
    it("nextIds는 서로 다른 id를 준다", async () => {
      // Given
      const repository = await createRepository();

      // When
      const ids = await repository.nextIds(3);

      // Then
      expect(new Set(ids.map((id) => id.value)).size).toBe(3);
    });

    it("한 번에 저장한 제안은 주인에게만 보이고 다시 저장하면 상태가 바뀐다", async () => {
      // Given
      const repository = await createRepository();
      const [suggestion] = await saveSuggestions(repository, [{}]);
      if (suggestion == null) {
        throw new Error("제안 준비 실패");
      }
      suggestion.dismiss(NOW);

      // When
      await repository.save(suggestion);
      const found = await repository.findByIdAndUserId(suggestion.id, USER_ID);
      const foreign = await repository.findByIdAndUserId(suggestion.id, OTHER_USER_ID);

      // Then
      expect(found?.toPrimitives()).toEqual(suggestion.toPrimitives());
      expect(found?.status).toBe("DISMISSED");
      expect(foreign).toBeNull();
    });

    it("대기 목록은 내 만료 전 PENDING만 만든 시각 내림차순, 같으면 id 내림차순이다", async () => {
      // Given
      const repository = await createRepository();
      const [older, tiedLow, tiedHigh] = await saveSuggestions(repository, [
        { createdAt: SUGGESTION_FIXTURE_NOW },
        { createdAt: SUGGESTION_FIXTURE_NOW.add({ minutes: 5 }) },
        { createdAt: SUGGESTION_FIXTURE_NOW.add({ minutes: 5 }) },
        { status: "ACCEPTED" },
        { expiresAt: PAST },
        { userId: SUGGESTION_FIXTURE_OTHER_USER_ID },
      ]);

      // When
      const pending = await repository.listPendingByUserId(USER_ID, NOW);

      // Then
      expect(pending.map((suggestion) => suggestion.id.value)).toEqual([
        tiedHigh?.id.value,
        tiedLow?.id.value,
        older?.id.value,
      ]);
    });

    it("대기 제안 지우기는 내 PENDING만, 만료 지우기는 상태와 상관없이 내 만료 제안만 지운다", async () => {
      // Given
      const repository = await createRepository();
      const [, accepted, , foreign] = await saveSuggestions(repository, [
        {},
        { status: "ACCEPTED" },
        { status: "DISMISSED", expiresAt: PAST },
        { userId: SUGGESTION_FIXTURE_OTHER_USER_ID },
      ]);

      // When
      const deletedPending = await repository.deletePendingByUserId(USER_ID);
      const deletedExpired = await repository.deleteExpiredByUserId(USER_ID, NOW);

      // Then
      expect([deletedPending, deletedExpired]).toEqual([1, 1]);
      expect(
        accepted == null ? null : await repository.findByIdAndUserId(accepted.id, USER_ID),
      ).not.toBeNull();
      expect(
        foreign == null ? null : await repository.findByIdAndUserId(foreign.id, OTHER_USER_ID),
      ).not.toBeNull();
    });
  });
}
