import { createSuggestionFixture } from "#test/fixtures/ai-assistance/suggestion.fixture";

import {
  toSuggestionActionResponse,
  toSuggestionResponse,
} from "./ai-suggestion-response.mapper.js";

describe("AI 제안 응답 매퍼", () => {
  it("저장된 요일이 요일 목록 모양이 아니면 빈 목록으로 응답한다", () => {
    // Given
    const suggestion = createSuggestionFixture({ daysOfWeek: null });

    // When
    const response = toSuggestionResponse(suggestion);

    // Then
    expect(response.daysOfWeek).toEqual([]);
    expect(response.expiresAt).toBe("2026-03-18T00:00:00.000Z");
  });

  it("수락 결과는 만든 반복 할 일 수와 수락 문구를 싣는다", () => {
    // Given
    const suggestion = createSuggestionFixture({ status: "ACCEPTED" });

    // When
    const response = toSuggestionActionResponse({ suggestion, createdTodosCount: 12 });

    // Then
    expect(response).toMatchObject({
      message: "제안이 수락되어 반복 할 일이 생성되었습니다.",
      createdTodosCount: 12,
    });
  });

  it("거절 결과는 할 일 수 없이 거절 문구만 싣는다", () => {
    // Given
    const suggestion = createSuggestionFixture({ status: "DISMISSED" });

    // When
    const response = toSuggestionActionResponse({ suggestion, createdTodosCount: null });

    // Then
    expect(response.message).toBe("제안이 거절되었습니다.");
    expect(response).not.toHaveProperty("createdTodosCount");
  });
});
