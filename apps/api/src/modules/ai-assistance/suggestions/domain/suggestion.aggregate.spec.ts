import { ErrorCode } from "@aido/api/errors";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";
import { createSuggestionFixture } from "#test/fixtures/ai-assistance/suggestion.fixture";

const NOW = Temporal.Instant.from("2026-03-23T00:00:00Z");
const NOT_EXPIRED = Temporal.Instant.from("2026-03-30T00:00:00Z");

describe("Suggestion 상태 전이", () => {
  it.each(["accept", "dismiss"] as const)(
    "대기 제안을 %s하고 같은 제안을 다시 처리할 수 없다",
    (action) => {
      // Given
      const model = createSuggestionFixture({ expiresAt: NOT_EXPIRED });

      // When
      const changed = model[action](NOW);

      // Then
      expect(changed).toBe(true);
      expect(model.status).toBe(action === "accept" ? "ACCEPTED" : "DISMISSED");
      expect(model.toPrimitives().updatedAt).toEqual(NOW);
      expect(() => model.accept(NOW)).toThrow(DomainException);
      expect(() => model.accept(NOW)).toThrow(
        expect.objectContaining({ errorCode: ErrorCode.AI_1306 }),
      );
    },
  );

  it("처리된 만료 제안은 만료보다 처리 상태 오류가 먼저다", () => {
    // Given
    const model = createSuggestionFixture({
      status: "ACCEPTED",
      expiresAt: Temporal.Instant.from("2026-03-22T00:00:00Z"),
    });

    // When
    const dismiss = () => model.dismiss(NOW);

    // Then
    expect(dismiss).toThrow(expect.objectContaining({ errorCode: ErrorCode.AI_1306 }));
  });

  it("만료된 대기 제안은 상태를 바꾸지 않는다", () => {
    // Given
    const model = createSuggestionFixture({
      expiresAt: Temporal.Instant.from("2026-03-22T00:00:00Z"),
    });

    // When
    const accept = () => model.accept(NOW);

    // Then
    expect(accept).toThrow(expect.objectContaining({ errorCode: ErrorCode.AI_1307 }));
    expect(model.status).toBe("PENDING");
  });

  it("만료 시각과 같은 시각은 기존 경계대로 처리할 수 있다", () => {
    // Given
    const model = createSuggestionFixture({ expiresAt: NOW });

    // When
    model.accept(NOW);

    // Then
    expect(model.status).toBe("ACCEPTED");
    expect(model.isPendingAt(NOW)).toBe(false);
  });
});
